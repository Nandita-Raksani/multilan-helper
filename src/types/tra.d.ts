// Type declaration for .tra file imports
// esbuild loads these as text content

declare module "*.tra" {
  const content: string;
  export default content;
}
