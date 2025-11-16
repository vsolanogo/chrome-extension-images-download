// src/sidepanel/SidePanel.tsx
import React from 'react';
import '../styles/common.css';
import './SidePanel.css';
import { ImageList } from '../components/ImageList';
import { Controls } from '../components/Controls';
import { useCapturedImages } from '../hooks/useCapturedImages';
import { useDownload } from '../hooks/useDownload';
import { loadAllImages } from '../utils/indexedDBUtils';

export const SidePanel = () => {
  const { images, imageCount, deleteImage, clearAllImages, downloadImage } = useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const link = 'https://github.com/guocaoyi/create-chrome-ext';

  console.log('SidePanel - Images count:', imageCount, 'Images array length:', images.length);

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
    <main className="sidepanel">
      <h3>Image Capture Extension</h3>
      <Controls
        onClearAll={clearAllImages}
        onDownloadAll={downloadAllImagesAsZip}
        count={imageCount}
        downloadDisabled={isDownloading}
        className="sidepanel-controls"
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
        showUrls={true}
        urlLength={50}
        itemClassName="sidepanel-image-item"
        emptyMessage="No images captured yet. Browse the web to start capturing images."
      />
      <a href={link} target="_blank" className="footer-link" rel="noreferrer">
        Image Capture Extension
      </a>
    </main>
  );
};

export default SidePanel;