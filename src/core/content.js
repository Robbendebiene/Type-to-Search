"use strict";


let triggerKey = "";


// set trigger key variable and apply keydown listener
browser.storage.local.get("triggerKey").then((data) => {
  triggerKey = data.triggerKey || "";
  window.addEventListener("keydown", handleKeydown, true);
});


// update trigger key variable on setting change
browser.storage.onChanged.addListener((changes) => {
  if (changes.hasOwnProperty("triggerKey")) {
    triggerKey = changes.triggerKey.newValue;
  }
});


/**
 * Handles the keydown events and sends a openSearchbar message to the background if conditions are met
 **/
function handleKeydown (event) {
  if (
    event.isTrusted &&
    // check if current target is not editable/typable
    !isEditable(event.target) &&
    // check if no modifier key is pressed (except shift)
    !event.altKey && !event.ctrlKey && !event.metaKey
  ) {
    // get selected text
    const selectedText = window.getSelection().toString();

    let pressedKey = "";

    // check if trigger key is set
    if (triggerKey) {
      // if key does not match exit function
      if (triggerKey !== event.code) return;
    }

    // check if is character key
    else if (!/\w\w/.test(event.key) && event.key !== " ") {
      pressedKey = event.key;
    }

    // if text is selected and enter is pressed
    else if (selectedText && event.key === "Enter") {}

    else return;

    browser.runtime.sendMessage({
      "subject": "openSearchbar",
      "data": {
        "pressedKey": pressedKey,
        "selectedText": selectedText
      }
    });

    event.preventDefault();
    event.stopImmediatePropagation();
  }
}


/**
 * Checks if the given element is a writable input element
 **/
function isEditable (element) {
  const editableInputTypes = ["text", "textarea", "password", "email", "number", "tel", "url", "search"];

  return (
    document.designMode === "on" ||
    element.isContentEditable ||
    (
      (element.localName === "input" || element.localName === "textarea" || element.localName === "select")
      && (!element.type || editableInputTypes.includes(element.type))
      && !element.disabled
      && !element.readOnly
    )
  );
}