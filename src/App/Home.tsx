/* 
Full Path: /src/App/Home.tsx
Last Modified: 2025-03-19 17:30:00
*/

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Map from './Map';
import Shop from './Shop';
import SearchFeature from './SearchFeature';
import './Home.scss';

type HomeProps = {
  data: Pwamap.ShopData[];
};

const Home: React.FC<HomeProps> = (props) => {
  const [selectedShop, setSelectedShop] = useState<Pwamap.ShopData | undefined>(undefined);
  const [filteredShops, setFilteredShops] = useState<Pwamap.ShopData[]>([]);

  // 親コンポーネントからのデータを設定
  useEffect(() => {
    if (props.data.length > 0) {
      setFilteredShops(props.data);
    }
  }, [props.data]);

  // 検索結果を受け取るハンドラ
  const handleSearchResults = useCallback((results: Pwamap.ShopData[]) => {
    setFilteredShops(results);
  }, []);

  // 店舗選択ハンドラ
  const handleSelectShop = useCallback((shop: Pwamap.ShopData) => {
    setSelectedShop(shop);
  }, []);

  // Shop閉じる処理
  const handleCloseShop = useCallback(() => {
    setSelectedShop(undefined);
  }, []);

  return (
    <div className="home">
      <SearchFeature 
        data={props.data}
        onSelectShop={handleSelectShop}
        onSearchResults={handleSearchResults}
      />
      <Map 
        data={filteredShops} 
        selectedShop={selectedShop}
        onSelectShop={handleSelectShop}
        initialData={props.data}
      />
      {selectedShop &&
        ReactDOM.createPortal(
          <Shop shop={selectedShop} close={handleCloseShop} />,
          document.getElementById('modal-root') as HTMLElement
        )
      }
    </div>
  );
};

export default Home;