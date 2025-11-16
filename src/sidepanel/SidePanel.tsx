import React from 'react'
import '../styles/common.css'
import './SidePanel.css'
import { ImageList } from '../components/ImageList';
import { Controls } from '../components/Controls';
import { useCapturedImages } from '../hooks/useCapturedImages';
import { useDownload } from '../hooks/useDownload';

export const SidePanel = () => {
  const { images, imageCount, deleteImage, clearAllImages, downloadImage, refreshImages } = useCapturedImages();
  const { downloadAllImagesAsZip: downloadAll, isDownloading } = useDownload();
  const link = 'https://github.com/guocaoyi/create-chrome-ext';

  console.log('SidePanel - Images count:', imageCount, 'Images array length:', images.length);

  // Function to download all images as a zip
  const downloadAllImagesAsZip = () => {
    chrome.runtime.sendMessage({ type: 'DOWNLOAD_IMAGES_AS_ZIP' }, (response) => {
      if (response && response.type === 'DOWNLOAD_IMAGES_AS_ZIP_RESPONSE') {
        downloadAll(response.images);
      }
    });
  };

  return (
    <main className="sidepanel">
      <h3>Image Capture Extension</h3>
      <Controls
        onClearAll={clearAllImages}
        onDownloadAll={downloadAllImagesAsZip}
        onRefresh={refreshImages}
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
        onDownload={downloadImage}
        showUrls={true}
        urlLength={50}
        layout="list"
        itemClassName="sidepanel-image-item"
        emptyMessage="No images captured yet. Browse the web to start capturing images."
      />
      <a href={link} target="_blank" className="footer-link">
        Image Capture Extension
      </a>
    </main>
  )
}

export default SidePanel
