"use strict";

// Note:
// if quickly canceling the loading of the iframe/overlay (for exmple via pressing escape or via window.stop()) the iframe onload will never be called
// this may be detected in the future via the "abort" event (https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onabort)

// holds the key that was pressed when starting the search
let pressedKey = "";


// holds the last text selection
let selectedText = "";


// holds the index of the currently active search engine
let searchEngineIndex = 0;


const SearchOverlay = document.createElement("iframe");

SearchOverlay.style = `
    all: initial !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483647 !important;
    background: rgba(0, 0, 0, 0.3) !important;
    opacity: 0 !important;
    transition: opacity .3s !important;
  `;
SearchOverlay.onload = initialize;
SearchOverlay.ontransitionend = handleTransitionEnd;
SearchOverlay.src = browser.extension.getURL("core/content.html");


const querySearchEngines = browser.runtime.sendMessage({
  "subject": "getSearchEngines"
});


browser.runtime.onMessage.addListener(handleMessages);


/**
 * Called on searchOverlay/iframe load
 * Set up all handlers and elements
 **/
function initialize () {
  const searchOverlayWindow = SearchOverlay.contentWindow;
  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchForm = searchOverlayDocument.getElementById("searchForm");
  const searchBar = searchOverlayDocument.getElementById("searchBar");
  const searchEnginesList = searchOverlayDocument.getElementById("searchEnginesList");

  searchBar.value = pressedKey;

  // focus iframe window before focusing input, otherwise sometimes the input does not receive focus
  searchOverlayWindow.focus();
  searchBar.focus();

  // append text to searchbar input and set caret position after the pressed key
  if (selectedText) {
    searchBar.value += selectedText;
    searchBar.selectionEnd = pressedKey.length;
  }

  searchForm.onsubmit = handleSearchSubmit;
  searchForm.addEventListener("focusout", handleFocusout);

  searchBar.oninput = handleSearchInput;

  searchEnginesList.ontransitionend = handleCycleSearchEnginesTransitionEnd;

  searchOverlayWindow.onkeydown = handleSearchKeydown;
  searchOverlayWindow.onwheel = handleSearchOverlayWheel;

  querySearchEngines.then((searchEngines) => {
    searchEngineIndex = searchEngines.findIndex(searchEngine => searchEngine.isDefault);
    const searchEngineItem = searchOverlayDocument.createElement("li");
          searchEngineItem.classList.add("search-engine-item", "active");
    const searchEngineIcon = searchOverlayDocument.createElement("img");
          searchEngineIcon.classList.add("search-engine-icon");
          searchEngineIcon.src = searchEngines[searchEngineIndex].favIconUrl;
    searchEngineItem.append(searchEngineIcon);
    searchEnginesList.append(searchEngineItem);

    SearchOverlay.style.setProperty('opacity', '1', 'important');
    searchForm.style.setProperty("animation-name", "slideIn");
  });
}


/**
 * Terminates the searchOverlay and resets variables
 **/
function terminate () {
  pressedKey = "";
  selectedText = "";
  searchEngineIndex = 0;

  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchForm = searchOverlayDocument.getElementById("searchForm");
  searchForm.style.setProperty("animation-name", "slideOut");

  SearchOverlay.style.setProperty('opacity', '0', 'important');

  // get computed style which also triggers reflow which immediately forces the transition
  const overlayComputedStyle = window.getComputedStyle(SearchOverlay);
  // if the opacity already is 0 directly remove the iframe because transitionend will never be called
  if (overlayComputedStyle.opacity === "0") {
    SearchOverlay.remove();
    return;
  }
}


/**
 * Terminates the searchOverlay if the newly focused element is not inside the form
 **/
function handleFocusout (event) {
  const searchOverlayDocument = SearchOverlay.contentDocument;
  // if focusout occurs on terminate/frame unload ignore it
  if (!searchOverlayDocument) return;
  const searchForm = searchOverlayDocument.getElementById("searchForm");
  if (!searchForm.contains(event.relatedTarget)) terminate();
}


/**
 * Handles the form submit, terminates the searchOverlay and sends the search query to the background
 **/
function handleSearchSubmit (event) {
  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchBar = searchOverlayDocument.getElementById("searchBar");

  querySearchEngines.then((searchEngines) => {
    browser.runtime.sendMessage({
      "subject": "search",
      "data": {
        "query": searchBar.value,
        "engine": searchEngines[searchEngineIndex].name
      }
    });

    terminate();
  });

  event.preventDefault();
}


/**
 * Handles the searchbar input and looks for search engine keywords at the start
 * updates the active search engine on match
 **/
function handleSearchInput (event) {
  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchBar = searchOverlayDocument.getElementById("searchBar");

  querySearchEngines.then((searchEngines) => {
    const activeSearchEngine = searchEngines[searchEngineIndex];

    for (const [index, searchEngine] of searchEngines.entries()) {
      // if string starts with search engine keyword and is followed by a space
      // and the active search engine is not associated with this keyword
      // then change active search engine
      if (searchBar.value.startsWith(searchEngine.alias +  " ") && searchEngine.name !== activeSearchEngine.name) {
        cycleSearchEngineItems(index - searchEngineIndex, searchEngines);
    
        // remove keyword from searchbar
        searchBar.value = searchBar.value.substr(searchEngine.alias.length + 1);

        // set caret position to start
        searchBar.selectionEnd = 0;
      }
    }
  });
}


/**
 * Handles key down events
 * Esc - terminate searchOverlay
 * Arrow Up/Down - change search engine
 **/
function handleSearchKeydown (event) {
  switch (event.key) {
    case 'Escape':
      terminate();
    break;

    case 'ArrowUp':
      querySearchEngines.then((searchEngines) => {
        cycleSearchEngineItems(1, searchEngines);
      });
    break;

    case 'ArrowDown':
      querySearchEngines.then((searchEngines) => {
        cycleSearchEngineItems(-1, searchEngines);
      });
    break;

    // exit function on other keys
    default:
      return;
  }

  event.preventDefault();
}


/**
 * Handles wheel up/down events and change search engine
 **/
function handleSearchOverlayWheel (event) {
  if (event.deltaY > 0) {
    querySearchEngines.then((searchEngines) => {
      cycleSearchEngineItems(-1, searchEngines);
    });
  }
  else {
    querySearchEngines.then((searchEngines) => {
      cycleSearchEngineItems(1, searchEngines);
    });
  }

  event.preventDefault();
}


/**
 * Handles the transitionend event for the search engine cycle transition
 * This clears all elements that are overflown and resets the y positions
 **/
function handleCycleSearchEnginesTransitionEnd () {
  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchEnginesList = searchOverlayDocument.getElementById("searchEnginesList");
  const activeSearchEngineItem = searchOverlayDocument.querySelector(".active");

  // remove all obsolete items
  for (const inactiveSearchEngineItem of searchEnginesList.querySelectorAll(".search-engine-item:not(.active)")) {
    inactiveSearchEngineItem.remove();
  }
  
  // reset all variables / positions
  searchEnginesList.style.removeProperty("--translateY");
  searchEnginesList.style.removeProperty("transition");
  activeSearchEngineItem.style.removeProperty("--positionTop");
}


/**
 * Handles the transitionend event and removes the search overlay
 **/
function handleTransitionEnd (event) {
  if (event.propertyName === "opacity" && SearchOverlay.style.getPropertyValue("opacity") === "0") {
    SearchOverlay.remove();
  }
}


/**
 * Switches to the search engine with X steps in a cyclic order
 **/
function cycleSearchEngineItems (step, searchEngines) {
  const searchOverlayDocument = SearchOverlay.contentDocument;
  const searchEnginesList = searchOverlayDocument.getElementById("searchEnginesList");

  let activeSearchEngineItem = searchEnginesList.querySelector(".active");

  // remove active class of current item
  activeSearchEngineItem.classList.remove("active");

  // do this for each step
  for (let i = 0; i < Math.abs(step); i++) {
    // get next item index (cyclic)
    searchEngineIndex = (searchEngines.length + searchEngineIndex + Math.sign(step)) % searchEngines.length;
    
    // calculate new y position based on previous position and step direction
    const currentY = Number(searchEnginesList.style.getPropertyValue("--translateY"));
    const nextY = currentY + Math.sign(step) * 100;
    
    searchEnginesList.style.setProperty("--translateY", nextY);
    searchEnginesList.style.setProperty("transition", " transform .3s");

    if (step < 0 && activeSearchEngineItem.nextElementSibling) {
      activeSearchEngineItem = activeSearchEngineItem.nextElementSibling;
    }
    else if (step > 0 && activeSearchEngineItem.previousElementSibling) {
      activeSearchEngineItem = activeSearchEngineItem.previousElementSibling;
    }
    // if no sibling element exists create a new one
    else {
      activeSearchEngineItem = searchOverlayDocument.createElement("li");
      activeSearchEngineItem.classList.add("search-engine-item");
      activeSearchEngineItem.style.setProperty("--positionTop", -nextY);

      const searchEngineIcon = searchOverlayDocument.createElement("img");
      searchEngineIcon.classList.add("search-engine-icon");
      searchEngineIcon.src = searchEngines[searchEngineIndex].favIconUrl;
      activeSearchEngineItem.append(searchEngineIcon);

      step < 0 ? searchEnginesList.append(activeSearchEngineItem) : searchEnginesList.prepend(activeSearchEngineItem);
    }
  }

  // add active class to new item
  activeSearchEngineItem.classList.add("active");
}


/**
 * Handle messages from the background script / child content scripts
 **/
function handleMessages (message, sender) {
  if (message.subject === "openSearchbar") {

    if (!SearchOverlay.isConnected) {
      // cache pressed key
      pressedKey = message.data.pressedKey;

      // cache text selection
      selectedText = message.data.selectedText;

      // append element to dom which triggers iframe load
      document.body.append(SearchOverlay);
    }
    // if search overlay has already been appended to DOM
    // catch unrecognized key presses from the start
    else {
      // append the key to the previously pressed key
      pressedKey += message.data.pressedKey;
    }
  }
}