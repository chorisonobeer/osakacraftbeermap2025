import React, { useState, useEffect, useMemo } from "react";
import ShopListItem from './ShopListItem';
import Shop from './Shop';
import './List.scss';
import { useSearchParams, useNavigate } from "react-router-dom";
import InfiniteScroll from 'react-infinite-scroll-component';
import { askGeolocationPermission } from '../geolocation';
import * as turf from "@turf/turf";
import { useSwipeable } from "react-swipeable";

// スケルトンローディングコンポーネント
const SkeletonItem = React.memo(() => (
  <div className="shop-list-item skeleton">
    <div className="skeleton-content">
      <div className="skeleton-title"></div>
      <div className="skeleton-text"></div>
    </div>
    <div className="skeleton-image"></div>
  </div>
));

type Props = {
  data: Pwamap.ShopData[];
};

type ShopDataWithDistance = Pwamap.ShopData & { distance?: number };

// 位置情報と距離計算のキャッシュ
let positionCache: { coords: { latitude: number; longitude: number }; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5分間キャッシュ

const sortShopList = async (shopList: Pwamap.ShopData[]): Promise<ShopDataWithDistance[]> => {
  // キャッシュされた位置情報を使用
  let currentPosition;
  if (positionCache && Date.now() - positionCache.timestamp < CACHE_DURATION) {
    currentPosition = [positionCache.coords.longitude, positionCache.coords.latitude];
  } else {
    const position = await askGeolocationPermission();
    if (position) {
      positionCache = {
        coords: { latitude: position[1], longitude: position[0] },
        timestamp: Date.now()
      };
      currentPosition = position;
    }
  }

  if (currentPosition) {
    const from = turf.point(currentPosition);
    const sortingShopList = shopList.map((shop) => {
      const lng = parseFloat(shop['経度']);
      const lat = parseFloat(shop['緯度']);
      if (Number.isNaN(lng) || Number.isNaN(lat)) {
        return shop;
      } else {
        const to = turf.point([lng, lat]);
        const distance = turf.distance(from, to, {units: 'meters'});
        return { ...shop, distance };
      }
    });
    sortingShopList.sort((a, b) => {
      if (typeof a.distance !== 'number' || Number.isNaN(a.distance)) {
        return 1;
      } else if (typeof b.distance !== 'number' || Number.isNaN(b.distance)) {
        return -1;
      } else {
        return (a.distance as number) - (b.distance as number);
      }
    });
    return sortingShopList;
  } else {
    return shopList;
  }
};

const Content = (props: Props) => {
  const [shop, setShop] = useState<Pwamap.ShopData | undefined>();
  const [data, setData] = useState<Pwamap.ShopData[]>(props.data);
  const [list, setList] = useState<Pwamap.ShopData[]>([]);
  const [page, setPage] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const queryCategory = searchParams.get('category');

  // データのキャッシュ
  const [cachedData, setCachedData] = useState<{
    [key: string]: {
      data: Pwamap.ShopData[];
      timestamp: number;
    };
  }>({});

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      const cacheKey = queryCategory || 'all';
      const now = Date.now();
      const CACHE_DURATION = 5 * 60 * 1000; // 5分間キャッシュ

      // キャッシュからデータを取得
      if (cachedData[cacheKey] && now - cachedData[cacheKey].timestamp < CACHE_DURATION) {
        if (isMounted) {
          setData(cachedData[cacheKey].data);
          setList(cachedData[cacheKey].data.slice(0, page));
          setIsLoading(false);
        }
        return;
      }

      let filteredData = props.data;

      if (queryCategory) {
        filteredData = props.data.filter((shop) => {
          const shopCategories = shop['カテゴリ']
            ? shop['カテゴリ'].split(/,|、|\s+/).map(cat => cat.trim())
            : [];
          return shopCategories.includes(queryCategory);
        });
      }

      const orderBy = process.env.REACT_APP_ORDERBY;

      if (orderBy === 'distance') {
        const sortedData = await sortShopList(filteredData);
        if (isMounted) {
          setCachedData(prev => ({
            ...prev,
            [cacheKey]: {
              data: sortedData,
              timestamp: now
            }
          }));
          setList(sortedData.slice(0, page));
          setData(sortedData);
          setIsLoading(false);
        }
      } else {
        if (isMounted) {
          setCachedData(prev => ({
            ...prev,
            [cacheKey]: {
              data: filteredData,
              timestamp: now
            }
          }));
          setList(filteredData.slice(0, page));
          setData(filteredData);
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [props.data, queryCategory, page, cachedData]);

  const popupHandler = (shop: Pwamap.ShopData) => {
    if (shop) {
      setShop(shop);
    }
  };

  const closeHandler = () => {
    setShop(undefined);
  };

  const loadMore = () => {

    if (list.length >= data.length) {
      setHasMore(false);
      return;
    }

    setList([...list, ...data.slice(page, page + 10)]);
    setPage(page + 10);
  };

  // スワイプハンドラーの設定
  const swipeHandlers = useSwipeable({
    onSwiped: (eventData) => {
      // X方向のスワイプのみを検出し、前の画面に戻る
      if (Math.abs(eventData.deltaX) > Math.abs(eventData.deltaY) && Math.abs(eventData.deltaX) > 50) {
        navigate(-1);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  // skeletonLoader を定義して、InfiniteScroll の loader として利用する
  const skeletonLoader = useMemo(() => (
    <div className="skeleton-container">
      {Array(3).fill(0).map((_, index) => (
        <SkeletonItem key={`skeleton-${index}`} />
      ))}
    </div>
  ), []);

  return (
    <div id="shop-list" className="shop-list" {...swipeHandlers}>
      {queryCategory && <div className="shop-list-category">{`カテゴリ：「${queryCategory}」`}</div>}

      <InfiniteScroll
        dataLength={list.length}
        next={loadMore}
        hasMore={hasMore}
        loader={isLoading ? skeletonLoader : <div className="list-loader" key="loader"></div>}
        scrollableTarget="shop-list"
      >
        {list.length === 0 ? skeletonLoader : 
          list.map((item) => (
            <div key={item.index} className="shop">
              <ShopListItem
                data={item}
                popupHandler={popupHandler}
                queryCategory={queryCategory}
              />
            </div>
          ))
        }
      </InfiniteScroll>
      
      {shop && <Shop shop={shop} close={closeHandler} />}
    </div>
  );
};

export default React.memo(Content);