"use strict";

browser.runtime.onMessage.addListener(handleMessages);

/**
 * Handle messages from content scripts
 * - search : starts a new search in the specified tab
 * - getSearchEngines : responds the results of the browser.search.get() function
 * - openSearchbar : forwards the received message to the top frame
 **/
async function handleMessages (message, sender) {
  switch (message.subject) {

    // start search query
    case "search":
      let tabId = null;

      const tabProperties = {
        openerTabId: sender.tab.id,
        url: "about:blank"
      };

      const searchTargetTab = (await browser.storage.local.get("searchTargetTab")).searchTargetTab;

      switch (searchTargetTab) {
        case "current":
          tabId = sender.tab.id;
        break;

        case "start":
          tabProperties.index = 0;
          tabId = (await browser.tabs.create(tabProperties)).id;
        break;
        
        case "end":
          tabProperties.index = Number.MAX_SAFE_INTEGER;
          tabId = (await browser.tabs.create(tabProperties)).id;
        break;

        case "before":
          tabProperties.index = sender.tab.index;
          tabId = (await browser.tabs.create(tabProperties)).id;
        break;
        
        case "after":
        default:
          tabProperties.index = sender.tab.index + 1;
          tabId = (await browser.tabs.create(tabProperties)).id;
        break;
      }

      browser.search.search({
        "query": message.data.query,
        "engine": message.data.engine,
        "tabId": tabId
      });
    break;

    // respond promise with search results
    case "getSearchEngines": return browser.search.get();

    // forward message to top frame
    case "openSearchbar":
      browser.tabs.sendMessage(sender.tab.id, message, { frameId: 0 });
    break;
  }
}