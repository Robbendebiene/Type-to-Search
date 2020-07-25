window.addEventListener("DOMContentLoaded", () => {
  // set up inputs
  const inputElements = document.querySelectorAll("[name]");
  const queryData = browser.storage.local.get();
  queryData.then((data) => {
    for (const inputElement of inputElements) {
      const name = inputElement.name;
      if (data.hasOwnProperty(name)) {
        inputElement.value = data[name];
      }
      inputElement.onchange = handleInputChange;
    }
  });

  // add event listeners
  const triggerKeyInput = document.getElementById("triggerKeyInput");
  triggerKeyInput.onkeydown = handleTriggerKeyInputKeydown;

  const clearTriggerKeyButton = document.getElementById("clearTriggerKeyButton");
  clearTriggerKeyButton.onclick = handleClearTriggerKeyButtonClick;
});



/**
 * Saves the input value to the storage on change
 **/
function handleInputChange () {
  browser.storage.local.set({ [this.name]: this.value });
}


/**
 * Writes the key code into the trigger key input
 **/
function handleTriggerKeyInputKeydown (event) {
  this.value = event.code;
  this.onchange();
  event.preventDefault();
}


/**
 * Clears the trigger key input
 **/
function handleClearTriggerKeyButtonClick (event) {
  const triggerKeyInput = document.getElementById("triggerKeyInput");
  triggerKeyInput.value = "";
  triggerKeyInput.onchange();
}