import { useEffect } from "react";

type Meta = {
  title: string;
  description: string;
  canonical: string;
};

function setOrCreateMeta(selector: string, attr: string, attrValue: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useDocumentMeta({ title, description, canonical }: Meta) {
  useEffect(() => {
    document.title = title;
    setOrCreateMeta('meta[name="description"]', "name", "description", description);
    setOrCreateMeta('meta[property="og:title"]', "property", "og:title", title);
    setOrCreateMeta('meta[property="og:description"]', "property", "og:description", description);
    setOrCreateMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setOrCreateMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    setOrCreateMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    setCanonical(canonical);
  }, [title, description, canonical]);
}
