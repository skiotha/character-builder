export function initAutoSelectable(element) {
  element.addEventListener("focus", function () {
    this.select();
  });
}
