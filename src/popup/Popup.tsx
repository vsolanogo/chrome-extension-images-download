// src/popup/Popup.tsx
import React from 'react';
import '../styles/common.css';
import './Popup.css';
import { ImageList } from '../components/ImageList';
import { Controls } from '../components/Controls';
import { useCapturedImages } from '../hooks/useCapturedImages';
import { useDownload } from '../hooks/useDownload';
import { loadAllImages } from '../utils/indexedDBUtils';

export const Popup = () => {
  const { images, imageCount, deleteImage, clearAllImages, downloadImage, refreshImages } = useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const link = 'https://github.com/guocaoyi/create-chrome-ext';

  console.log('Popup - Images count:', imageCount, 'Images array length:', images.length);

  // Function to download all images as a zip
  const downloadAllImagesAsZip = async () => {
    try {
      // Load images directly from IndexedDB
      const allImages = await loadAllImages();
      downloadAll(allImages);
    } catch (error) {
      console.error('Error downloading all images:', error);
    }
  };

  return (
    <main className="popup">
      <h3>Image Capture Extension</h3>
      <Controls
        onClearAll={clearAllImages}
        onDownloadAll={downloadAllImagesAsZip}
        onRefresh={refreshImages}
        count={imageCount}
        downloadDisabled={isDownloading}
        showZipInfo={true}
      />
      <div className="image-count">
        Captured Images: {imageCount}
      </div>
      <ImageList
        images={images}
        onDelete={deleteImage}
        onDownload={async (image) => {
          try {
            await downloadImage(image);
          } catch (error) {
            console.error('Error downloading image:', error);
          }
        }}
        itemClassName="popup-image-item"
        emptyMessage="No images captured yet. Browse the web to start capturing images."
      />
      <a href={link} target="_blank" className="footer-link" rel="noreferrer">
        Image Capture Extension
      </a>
    </main>
  );
};

export default Popup;