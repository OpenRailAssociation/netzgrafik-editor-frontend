declare module "save-svg-as-png" {
  export interface SvgExportOptions {
    encoderOptions?: number;
    scale?: number;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    backgroundColor?: string;
  }

  export function svgAsDataUri(el: Element, options?: SvgExportOptions): Promise<string>;

  export function saveSvgAsPng(
    el: Element,
    name: string,
    options?: SvgExportOptions,
  ): Promise<void>;
}
