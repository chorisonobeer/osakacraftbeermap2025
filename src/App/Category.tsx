import React from "react";
import Select from 'react-select'
import { useNavigate } from 'react-router-dom';
import './Category.scss'

type Props = {
  data: Pwamap.ShopData[];
}

const Content = (props: Props) => {

  const navigate = useNavigate();

  const [categoryList, setCategoryList] = React.useState<string[]>([]);

  React.useEffect(() => {
    let categories: string[] = [];

    for (let i = 0; i < props.data.length; i++) {
      const shop = props.data[i];
      
      if (shop['カテゴリ']) {
        // カンマ、全角カンマ、空白で分割してカテゴリを追加
        const shopCategories = shop['カテゴリ']
          .split(/,|、|\s+/)
          .map(cat => cat.trim())
          .filter(cat => cat !== '');
        
        for (const category of shopCategories) {
          if (categories.indexOf(category) === -1) {
            categories.push(category);
          }
        }
      }
    }

    // カテゴリをアルファベット順にソート
    categories.sort();
    setCategoryList(categories);
  }, [props.data]);


  return (
    <>
      <div className="head"></div>
      <div className="category">
        <div className="container">
          <div className="category-item">
            <label htmlFor="category-select">カテゴリから選ぶ</label>
            <Select
              onChange={(e) => {
                if (e) {
                  navigate(`/list?category=${e.value}`);
                }
              }}
              options={
                categoryList.map(category => {
                  return {
                    value: category,
                    label: category
                  }
                })
              }
            />
          </div>

        </div>
      </div>
    </>
  );
};

export default Content;
