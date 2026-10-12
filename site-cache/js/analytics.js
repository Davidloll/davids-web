(function () {
  if (window.__truffledGoogleTag) return;
  window.__truffledGoogleTag = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  const proxy = /^(\/studying\/(?:frame(?:\/|\.html)|service\/)|\/cm\.html)/.test(location.pathname);
  const pagePath = proxy ? "/proxy" : location.pathname;
  window.gtag("js", new Date());
  window.gtag("config", "G-PXHK7Q7G3Z", {
    page_location: location.origin + pagePath,
    page_referrer: "",
    page_title: proxy ? "Proxy" : document.title,
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-PXHK7Q7G3Z";
  document.head.appendChild(script);
  window.trackProxyNavigation = function () {
    window.gtag("event", "proxy_navigation", {
      page_location: location.origin + "/proxy",
      page_referrer: "",
      page_title: "Proxy",
    });
  };
})();
