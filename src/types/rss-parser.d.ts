declare module 'rss-parser' {
  interface Item {
    title?: string;
    link?: string;
    pubDate?: string;
    creator?: string;
    author?: string;
    content?: string;
    contentSnippet?: string;
    isoDate?: string;
    [key: string]: any;
  }

  interface Output {
    title?: string;
    description?: string;
    items: Item[];
    [key: string]: any;
  }

  class Parser {
    constructor(options?: any);
    parseURL(url: string): Promise<Output>;
    parseString(xml: string): Promise<Output>;
  }

  export = Parser;
}