import { CapturedImage } from "../utils/indexedDBUtils";
import { ImageItem } from "./ImageItem";

interface ImageListProps {
  images: CapturedImage[];
  onDelete: (url: string) => void;
  showUrls?: boolean;
  urlLength?: number;
  className?: string;
  itemClassName?: string;
  emptyMessage?: string;
}

export const ImageList: React.FC<ImageListProps> = ({
  images,
  onDelete,
  showUrls = true,
  urlLength = 30,
  className = "",
  itemClassName = "",
  emptyMessage = "No images captured yet. Browse the web to start capturing images.",
}) => {
  console.log(images);
  return (
    <div className={`${className} image-list`}>
      {images.length > 0 ? (
        images.map((image) => (
          <ImageItem
            key={image.url}
            image={image}
            onDelete={onDelete}
            showUrl={showUrls}
            urlLength={urlLength}
            className={itemClassName}
          />
        ))
      ) : (
        <div className="no-images">{emptyMessage}</div>
      )}
    </div>
  );
};
