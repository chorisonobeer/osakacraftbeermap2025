import React, { useEffect, useRef, useState, useContext } from "react";
import Links from "./Links";
import "./Shop.scss";
import { AiOutlineClose } from "react-icons/ai";
import { Link } from "react-router-dom";
import { makeDistanceLabelText } from "./distance-label";
import { GeolocationContext } from "../context/GeolocationContext";
import * as turf from "@turf/turf";

type Props = {
  shop: Pwamap.ShopData;
  close: () => void;
};

const SWIPE_THRESHOLD = 80;

const Shop: React.FC<Props> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [localDistance, setLocalDistance] = useState<number | undefined>(props.shop.distance);
  const [isClosing, setIsClosing] = useState(false);
  const currentPosition = useContext(GeolocationContext);

  // アニメーション用: マウント時に .slide-in クラスを付与して右側からスライドイン
  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current?.classList.add("slide-in");
      }, 10);
    }
  }, []);

  // もしprops.shop.distanceが未定義なら、現在位置からの距離を計算
  useEffect(() => {
    if (localDistance === undefined && currentPosition) {
      const from = turf.point(currentPosition);
      const lng = parseFloat(props.shop["経度"]);
      const lat = parseFloat(props.shop["緯度"]);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
        const to = turf.point([lng, lat]);
        const distance = turf.distance(from, to, { units: 'meters' as 'meters' });
        setLocalDistance(distance);
      } else {
        setLocalDistance(Infinity);
      }
    }
  }, [localDistance, currentPosition, props.shop]);

  // タッチイベント用の座標管理
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = null;
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.changedTouches[0].clientX;
    handleSwipeGesture();
  };

  // スワイプ判定: 一定以上の横スワイプで閉じる（閉じるボタンと同じ動作）
  const handleSwipeGesture = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const deltaX = touchStartX.current - touchEndX.current;
    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    // アニメーション完了後に実際のclose処理を実行
    setTimeout(() => {
      props.close();
    }, 300); // CSSのtransition時間と合わせる
  };

  const distanceTipText =
    localDistance !== undefined && localDistance !== Infinity
      ? makeDistanceLabelText(localDistance)
      : "距離不明";

  // カテゴリの分割処理
  const categories = props.shop["カテゴリ"] 
    ? props.shop["カテゴリ"].split(/,|、|\s+/).map(cat => cat.trim()).filter(cat => cat !== '')
    : [];
  
  const content = props.shop["紹介文"] || "";
  const spotName = props.shop["スポット名"] || "店名不明";

  const hours = props.shop["営業時間"] || "営業時間不明";
  const closed = props.shop["定休日"] || "定休日不明";
  const address = props.shop["住所"] || "住所不明";
  const tel = props.shop["TEL"];
  const site = props.shop["公式サイト"];

  // 画像データの処理
  const getImages = () => {
    const imageKeys = ['画像', '画像2', '画像3', '画像4', '画像5'];
    return imageKeys
      .map(key => props.shop[key])
      .filter(img => img && img.trim() !== '')
      .map(img => {
        // 既にURLの場合はそのまま使用、ファイル名のみの場合はpublicフォルダからのパスとして扱う
        if (img.startsWith('http')) {
          return img;
        } else {
          return `/${img}`; // publicフォルダからの相対パス
        }
      });
  };

  const images = getImages();

  return (
    <div
      className={`shop-single ${isClosing ? 'closing' : ''}`}
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="head">
        <button onClick={handleClose}>
          <AiOutlineClose size="16px" color="#FFFFFF" /> 閉じる
        </button>
      </div>
      <div className="container">
        <h2 className="shop-title">{spotName}</h2>

        {/* カテゴリと距離を同じ行で並べる */}
        <div className="tag-box">
          {categories.map((category, index) => (
            <Link key={`cat-${index}`} to={`/list?category=${category}`}>
              <span className="category">{category}</span>
            </Link>
          ))}
          {distanceTipText && (
            <span className="distance">現在位置から {distanceTipText}</span>
          )}
        </div>

        {/* SNS リンクをカテゴリの下に配置 */}
        <Links data={props.shop} />

        <div className="shop-info-box">
          <div className="info-item">
            <span className="info-label">営業時間:</span> {hours}
          </div>
          <div className="info-item">
            <span className="info-label">定休日:</span> {closed}
          </div>
          <div className="info-item">
            <span className="info-label">住所:</span> {address}
          </div>
        </div>

        {images.length > 0 && (
          <div className="shop-images-grid">
            {images.map((imgUrl, index) => (
              <div key={`image-${index}`} className="shop-image-item">
                <img src={imgUrl} alt={`${spotName} 画像${index + 1}`} className="shop-image" />
              </div>
            ))}
          </div>
        )}

        {content && (
          <p style={{ margin: "24px 0", wordBreak: "break-all" }}>{content}</p>
        )}

        <div className="action-buttons">
          {tel && (
            <a href={`tel:${tel}`} className="action-button phone-button">
              電話で予約する
            </a>
          )}
          {site && (
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button web-button"
            >
              ネットで予約する
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shop;