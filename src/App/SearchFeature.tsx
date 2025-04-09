import React, { useState, useEffect, useCallback, useRef } from 'react';
import './SearchFeature.scss';

type SearchFeatureProps = {
  data: Pwamap.ShopData[];
  onSearchResults: (results: Pwamap.ShopData[]) => void;
  onSelectShop: (shop: Pwamap.ShopData) => void;
};

const SearchFeature: React.FC<SearchFeatureProps> = ({ data, onSearchResults, onSelectShop }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [isOpenNow, setIsOpenNow] = useState(false);
  const [hasParking, setHasParking] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [results, setResults] = useState<Pwamap.ShopData[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  // クリック外のイベントを監視して、ドロップダウンを閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(event.target as Node)) {
        setShowAreaDropdown(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // カテゴリ一覧を作成
  useEffect(() => {
    if (data.length > 0) {
      const allCategories = data
        .map(shop => shop['カテゴリ'])
        .filter(Boolean)
        .flatMap(category => category.split(/,|、|\s+/))
        .map(category => category.trim())
        .filter(category => category !== '');
      
      const uniqueCategories = Array.from(new Set(allCategories))
        .sort();
      
      setCategories(uniqueCategories);
    }
  }, [data]);

  // エリア一覧を作成
  useEffect(() => {
    if (data.length > 0) {
      const uniqueAreas = Array.from(new Set(data
        .map(shop => shop['エリア'])
        .filter(Boolean)))
        .sort();
      
      setAreas(uniqueAreas);
    }
  }, [data]);

  // フィルタリング処理
  const filterShops = useCallback(() => {
    let filtered = data;
    console.debug(`フィルタリング開始：全店舗数 ${filtered.length}`);

    // テキスト検索
    if (query.trim() !== '') {
      filtered = filtered.filter(shop => {
        return Object.entries(shop).some(([_, value]) => {
          if (typeof value === 'string') {
            return value.toLowerCase().includes(query.toLowerCase());
          }
          return false;
        });
      });
      console.debug(`テキスト検索後： ${filtered.length} 件`);
    }

    // カテゴリでフィルタリング
    if (selectedCategory) {
      filtered = filtered.filter(shop => {
        const shopCategories = shop['カテゴリ']
          ? shop['カテゴリ'].split(/,|、|\s+/).map(cat => cat.trim())
          : [];
        return shopCategories.includes(selectedCategory);
      });
      console.debug(`カテゴリフィルタ後： ${filtered.length} 件`);
    }

    // エリアでフィルタリング
    if (selectedArea) {
      filtered = filtered.filter(shop => shop['エリア'] === selectedArea);
      console.debug(`エリアフィルタ後： ${filtered.length} 件`);
    }

    // 営業中でフィルタリング
    if (isOpenNow) {
      // 現在時刻をJST（UTC+9）に補正して取得
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const jstNow = new Date(utc + 9 * 60 * 60000);
      const currentHour = jstNow.getHours();
      const currentMinute = jstNow.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;
      console.debug(`現在のJST時刻: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][jstNow.getDay()];

      filtered = filtered.filter(shop => {
        // 定休日チェック：カンマ、全角カンマ、空白で分割してチェック
        if (shop['定休日']) {
          const closedDays = shop['定休日']
            .split(/,|、|\s+/)
            .map(day => day.trim())
            .filter(day => day !== '');
          if (closedDays.some(day => day.includes(dayOfWeek))) {
            console.debug(`店舗[${shop['スポット名']}]：定休日(${dayOfWeek})のため除外`);
            return false;
          }
        }

        // 営業時間チェック（例: "10:00 - 17:00" の形式）
        if (shop['営業時間']) {
          const timeRangeMatch = shop['営業時間'].match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
          if (timeRangeMatch) {
            const [, startHourStr, startMinuteStr, endHourStr, endMinuteStr] = timeRangeMatch;
            const startHour = parseInt(startHourStr, 10);
            const startMinute = parseInt(startMinuteStr, 10);
            const endHour = parseInt(endHourStr, 10);
            const endMinute = parseInt(endMinuteStr, 10);
            const startTimeMinutes = startHour * 60 + startMinute;
            const endTimeMinutes = endHour * 60 + endMinute;
            
            console.debug(`店舗[${shop['スポット名']}] 営業時間: ${startHour}:${startMinute.toString().padStart(2, '0')} ～ ${endHour}:${endMinute.toString().padStart(2, '0')}、現在: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);

            // 深夜営業対応（例: 22:00 - 02:00）
            if (endTimeMinutes < startTimeMinutes) {
              // 終了時間が開始時間より前の場合（深夜営業）
              const isOpen = currentTimeMinutes >= startTimeMinutes || currentTimeMinutes <= endTimeMinutes;
              console.debug(`店舗[${shop['スポット名']}]: 深夜営業判定 = ${isOpen ? '営業中' : '営業時間外'}`);
              return isOpen;
            } else {
              // 通常の営業時間
              const isOpen = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes;
              console.debug(`店舗[${shop['スポット名']}]: 通常営業判定 = ${isOpen ? '営業中' : '営業時間外'}`);
              return isOpen;
            }
          } else {
            console.warn(`店舗[${shop['スポット名']}]：営業時間の形式が不明 (${shop['営業時間']})`);
            // フォーマット不明な場合は営業中でないと判断
            return false;
          }
        }
        
        // 営業時間情報がない場合は営業中でないと判断
        console.debug(`店舗[${shop['スポット名']}]：営業時間情報なし`);
        return false;
      });
      console.debug(`営業時間フィルタ後： ${filtered.length} 件`);
    }

    // 駐車場フィルタリング
    if (hasParking) {
      filtered = filtered.filter(shop => {
        if (!shop['駐車場']) return false;
        const parkingStr = shop['駐車場'].trim();
        const parkingCountMatch = parkingStr.match(/(\d+)/);
        if (parkingCountMatch) {
          const parkingCount = parseInt(parkingCountMatch[1], 10);
          return parkingCount >= 1;
        }
        return parkingStr.includes('有') || parkingStr.includes('あり');
      });
      console.debug(`駐車場フィルタ後： ${filtered.length} 件`);
    }

    console.debug(`最終フィルタ結果： ${filtered.length} 件`);
    setResults(filtered);
    onSearchResults(filtered);
  }, [data, query, selectedCategory, selectedArea, isOpenNow, hasParking, onSearchResults]);

  // フィルター条件が変わったら再フィルタリング
  useEffect(() => {
    filterShops();
  }, [filterShops]);

  // 検索入力ハンドラー
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowResults(e.target.value.trim() !== '');
  };

  // カテゴリ選択ハンドラー
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setShowCategoryDropdown(false);
  };

  // エリア選択ハンドラー
  const handleAreaSelect = (area: string) => {
    setSelectedArea(area);
    setShowAreaDropdown(false);
  };

  // 結果アイテムクリックハンドラー
  const handleResultClick = (shop: Pwamap.ShopData) => {
    onSelectShop(shop);
    setShowResults(false);
  };

  return (
    <div className="search-feature">
      <div className="search-input-container">
        <input
          type="text"
          placeholder="スポットを検索..."
          value={query}
          onChange={handleInputChange}
          className="search-input"
        />
        {query && (
          <button 
            className="clear-button" 
            onClick={() => {
              setQuery('');
              setShowResults(false);
              onSearchResults(data);
            }}
            aria-label="入力をクリア"
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-container">
        <div className="filter-row">
          {/* カテゴリドロップダウン */}
          <div className="filter-item category-filter" ref={categoryDropdownRef}>
            <div 
              className={`custom-dropdown-header ${selectedCategory ? 'active' : ''}`}
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            >
              {selectedCategory === '' ? 'カテゴリ' : selectedCategory}
              <span className="dropdown-icon">▼</span>
            </div>
            {showCategoryDropdown && (
              <div className="custom-dropdown-list">
                <div 
                  className="custom-dropdown-item"
                  onClick={() => handleCategorySelect('')}
                >
                  すべて
                </div>
                {categories.map((category) => (
                  <div
                    key={category}
                    className="custom-dropdown-item"
                    onClick={() => handleCategorySelect(category)}
                  >
                    {category}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* エリアドロップダウン */}
          <div className="filter-item area-filter" ref={areaDropdownRef}>
            <div 
              className={`custom-dropdown-header ${selectedArea ? 'active' : ''}`}
              onClick={() => setShowAreaDropdown(!showAreaDropdown)}
            >
              {selectedArea === '' ? 'エリア' : selectedArea}
              <span className="dropdown-icon">▼</span>
            </div>
            {showAreaDropdown && (
              <div className="custom-dropdown-list">
                <div 
                  className="custom-dropdown-item"
                  onClick={() => handleAreaSelect('')}
                >
                  すべて
                </div>
                {areas.map((area) => (
                  <div
                    key={area}
                    className="custom-dropdown-item"
                    onClick={() => handleAreaSelect(area)}
                  >
                    {area}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 現在営業中ボタン */}
          <div className="filter-item operation-filter">
            <button
              className={`filter-button ${isOpenNow ? 'active' : ''}`}
              onClick={() => setIsOpenNow(!isOpenNow)}
            >
              現在営業中
            </button>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-item parking-filter" style={{ marginLeft: 'auto', marginRight: '0', position: 'absolute', right: '0', top: '100%' }}>
            <button
              className={`filter-button ${hasParking ? 'active' : ''}`}
              onClick={() => setHasParking(!hasParking)}
            >
              駐車場有り
            </button>
          </div>
        </div>
      </div>

      {showResults && (
        <div className="search-results">
          {results.length === 0 ? (
            <div className="no-results">該当する店舗がありません</div>
          ) : (
            <div className="results-list">
              {results.map((shop, index) => (
                <div
                  key={`shop-result-${index}`}
                  className="result-item"
                  onClick={() => handleResultClick(shop)}
                >
                  <div className="result-info">
                    <div className="result-name" style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>
                      {shop['スポット名']}
                    </div>
                    <div className="result-hours" style={{ fontSize: '8pt', fontWeight: '600' }}>
                      営業時間： {shop['営業時間'] ? shop['営業時間'] : '営業時間不明'}
                    </div>
                    <div className="result-closed" style={{ fontSize: '8pt', fontWeight: '600' }}>
                      定休日：{shop['定休日'] ? shop['定休日'] : '定休日不明'}
                    </div>
                    <div className="result-address" style={{ fontSize: '8pt', fontWeight: '600' }}>
                      住所： {shop['住所'] ? shop['住所'] : '住所不明'}
                    </div>
                  </div>
                  <div className="result-image">
                    {shop['画像'] ? (
                      <img
                        src={shop['画像'].startsWith('http') ? shop['画像'] : `/${shop['画像']}`}
                        alt={shop['スポット名']}
                        style={{ width: 'auto', height: '100%', margin: 0, display: 'block' }}
                      />
                    ) : (
                      <div style={{ width: 'auto', height: '100%', background: '#ccc' }}></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFeature;