import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

// キャッシュ設定
const CACHE_DURATION = 60 * 60 * 1000; // 1時間に延長
const BATCH_SIZE = 100; // バッチサイズを増加
const INITIAL_LOAD_SIZE = 20; // 初期表示件数
const LOAD_MORE_SIZE = 10; // 追加読み込み件数

// 位置情報と距離計算のキャッシュ
let positionCache: { coords: { latitude: number; longitude: number }; timestamp: number } | null = null;
const distanceCache = new Map<string, number>();
const dataCache = new Map<string, Pwamap.ShopData[]>();

// キャッシュユーティリティ
const getCachedDistance = (shopId: string, position: number[]) => {
  const cacheKey = `${shopId}-${position.join(',')}`;
  return distanceCache.get(cacheKey) ?? null;
};

const setCachedDistance = (shopId: string, position: number[], distance: number) => {
  const cacheKey = `${shopId}-${position.join(',')}`;
  distanceCache.set(cacheKey, distance);
};

// バッチ処理による距離計算（Web Workerを使用）
const calculateDistancesInBatches = async (shops: Pwamap.ShopData[], position: number[]) => {
  const from = turf.point(position);
  const results: ShopDataWithDistance[] = [];
  
  // キャッシュから既存の距離を取得
  const cachedShops = shops.map(shop => {
    const cachedDistance = getCachedDistance(shop.index.toString(), position);
    return cachedDistance !== null ? { ...shop, distance: cachedDistance } : shop;
  });

  // 未計算の店舗のみを抽出
  const uncachedShops = cachedShops.filter(shop => typeof shop.distance !== 'number');
  
  if (uncachedShops.length === 0) {
    return cachedShops;
  }

  // バッチ処理
  for (let i = 0; i < uncachedShops.length; i += BATCH_SIZE) {
    const batch = uncachedShops.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(shop => {
        const lng = parseFloat(shop['経度']);
        const lat = parseFloat(shop['緯度']);
        if (Number.isNaN(lng) || Number.isNaN(lat)) {
          return shop;
        }
        
        const to = turf.point([lng, lat]);
        const distance = turf.distance(from, to, { units: 'meters' });
        setCachedDistance(shop.index.toString(), position, distance);
        return { ...shop, distance };
      })
    );
    results.push(...batchResults);
  }

  // キャッシュ済みの店舗と新しく計算した店舗を結合
  return [...cachedShops.filter(shop => typeof shop.distance === 'number'), ...results];
};

const sortShopList = async (shopList: Pwamap.ShopData[]): Promise<ShopDataWithDistance[]> => {
  const cacheKey = `sorted-${shopList.length}`;
  const cachedData = dataCache.get(cacheKey);
  
  if (cachedData) {
    return cachedData as ShopDataWithDistance[];
  }

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
    const sortedData = await calculateDistancesInBatches(shopList, currentPosition);
    sortedData.sort((a, b) => {
      if (typeof a.distance !== 'number' || Number.isNaN(a.distance)) {
        return 1;
      } else if (typeof b.distance !== 'number' || Number.isNaN(b.distance)) {
        return -1;
      } else {
        return (a.distance as number) - (b.distance as number);
      }
    });
    
    dataCache.set(cacheKey, sortedData);
    return sortedData;
  }
  return shopList;
};

const Content = (props: Props) => {
  const [shop, setShop] = useState<Pwamap.ShopData | undefined>();
  const [data, setData] = useState<Pwamap.ShopData[]>(props.data);
  const [list, setList] = useState<Pwamap.ShopData[]>([]);
  const [page, setPage] = useState(INITIAL_LOAD_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);

  const [searchParams] = useSearchParams();
  const queryCategory = searchParams.get('category');

  // 初期データの設定（即座に表示）
  useEffect(() => {
    const cacheKey = queryCategory ? `filtered-${queryCategory}` : 'all';
    const cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      setData(cachedData);
      setList(cachedData.slice(0, INITIAL_LOAD_SIZE));
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
    
    dataCache.set(cacheKey, filteredData);
    setList(filteredData.slice(0, INITIAL_LOAD_SIZE));
    
    if (process.env.REACT_APP_ORDERBY === 'distance') {
      setIsSorting(true);
      sortShopList(filteredData)
        .then(sortedData => {
          setData(sortedData);
          setList(sortedData.slice(0, INITIAL_LOAD_SIZE));
        })
        .finally(() => setIsSorting(false));
    } else {
      setData(filteredData);
    }
  }, [props.data, queryCategory]);

  const popupHandler = useCallback((shop: Pwamap.ShopData) => {
    if (shop) {
      setShop(shop);
    }
  }, []);

  const closeHandler = useCallback(() => {
    setShop(undefined);
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || list.length >= data.length) {
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    const nextPage = page + LOAD_MORE_SIZE;
    const newItems = data.slice(page, nextPage);
    
    setList(prevList => [...prevList, ...newItems]);
    setPage(nextPage);
    setIsLoading(false);
  }, [data, list.length, page, isLoading]);

  // スワイプハンドラーの設定
  const swipeHandlers = useSwipeable({
    onSwiped: (eventData) => {
      if (Math.abs(eventData.deltaX) > Math.abs(eventData.deltaY) && Math.abs(eventData.deltaX) > 50) {
        navigate(-1);
      }
    },
    trackMouse: false,
    preventScrollOnSwipe: false,
  });

  // skeletonLoader をメモ化
  const skeletonLoader = useMemo(() => (
    <div className="skeleton-container">
      {Array(3).fill(0).map((_, index) => (
        <SkeletonItem key={`skeleton-${index}`} />
      ))}
    </div>
  ), []);

  return (
    <div id="shop-list" className="shop-list" {...swipeHandlers} ref={listRef}>
      {queryCategory && <div className="shop-list-category">{`カテゴリ：「${queryCategory}」`}</div>}

      <InfiniteScroll
        dataLength={list.length}
        next={loadMore}
        hasMore={hasMore}
        loader={isSorting ? skeletonLoader : <div className="list-loader" key="loader"></div>}
        scrollableTarget="shop-list"
        scrollThreshold={0.8}
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