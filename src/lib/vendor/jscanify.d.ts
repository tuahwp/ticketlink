export interface CornerPoint {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeftCorner: CornerPoint;
  topRightCorner: CornerPoint;
  bottomLeftCorner: CornerPoint;
  bottomRightCorner: CornerPoint;
}

export default class jscanify {
  constructor();
  findPaperContour(img: any): any;
  highlightPaper(image: any, options?: { color?: string; thickness?: number }): HTMLCanvasElement;
  extractPaper(
    image: any,
    resultWidth: number,
    resultHeight: number,
    cornerPoints?: CornerPoints
  ): HTMLCanvasElement | null;
  getCornerPoints(contour: any, img?: any): CornerPoints;
}
