// src/popup/Popup.tsx
import "../styles/common.css";
import "./Popup.css";
import { ImageCaptureInterface } from "../components/ImageCaptureInterface";

export const Popup = () => {
  return <ImageCaptureInterface className="popup" urlLength={30} />;
};

export default Popup;
