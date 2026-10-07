export interface ViewerImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
  alt: string;
}

export interface ImageViewerProps {
  images: ViewerImage[];
  index: number;
  open: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}
