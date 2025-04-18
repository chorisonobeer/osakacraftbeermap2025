import { BsChevronCompactRight } from 'react-icons/bs';
import './ShopListItem.scss';
import { Link } from "react-router-dom";
import { makeDistanceLabelText } from "./distance-label";

type Props = {
  data: Pwamap.ShopData;
  popupHandler: Function;
  queryCategory: string | null;
};

const Content = (props: Props) => {
  const clickHandler = () => {
    props.popupHandler(props.data);
  };

  const distanceTipText = props.data.distance !== undefined 
    ? makeDistanceLabelText(props.data.distance)
    : '距離不明';
  
  // カテゴリの分割処理
  const categories = props.data['カテゴリ'] 
    ? props.data['カテゴリ'].split(/,|、|\s+/).map(cat => cat.trim()).filter(cat => cat !== '')
    : [];
  
  const image = props.data['画像'];
  const isCategoryPage = props.queryCategory ? true : false;

  return (
    <div className="shop-link">
      <h2 className="shop-title" style={{ wordBreak: "break-all" }} onClick={clickHandler}>
        {props.data['スポット名']}
      </h2>
      <div className='tag-box'>
        {
          !isCategoryPage && categories.map((category, index) => (
            <span className="nowrap" key={`cat-${index}`}>
              <Link to={`/list?category=${category}`}>
                <span className="category">{category}</span>
              </Link>
            </span>
          ))
        }
        <span className="nowrap">
          <span className="distance">現在位置から {distanceTipText}</span>
        </span>
      </div>
      <div style={{ margin: "10px 10px 10px 0" }}>
        { image && <img src={image} alt={props.data['スポット名']} onClick={clickHandler}/> }
      </div>
      <div className="right" onClick={clickHandler}>
        <BsChevronCompactRight size="40px" color="#CCCCCC" />
      </div>
    </div>
  );
};

export default Content;
