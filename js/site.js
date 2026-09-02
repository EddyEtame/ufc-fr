document.documentElement.classList.add("js-motion");
window.setTimeout(function () {
  document.documentElement.classList.add("motion-ready");
}, 4000);

(function () {
  const burger = document.querySelector("[data-menu]");
  const drawer = document.querySelector("[data-drawer]");
  if (!burger || !drawer) return;
  burger.addEventListener("click", function () {
    const open = drawer.classList.toggle("open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  drawer.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () {
      drawer.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    });
  });
})();
