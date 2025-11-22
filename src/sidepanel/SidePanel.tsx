// src/sidepanel/SidePanel.tsx
import "../styles/common.css";
import "./SidePanel.css";
import { ImageCaptureInterface } from "../components/ImageCaptureInterface";

export const SidePanel = () => {
  return <ImageCaptureInterface className="sidepanel" urlLength={50} />;
};

export default SidePanel;
