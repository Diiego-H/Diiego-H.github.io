// Thumbnails in the publication list can be a cropped version of a figure. If a file named
// "<name>_full.<ext>" exists next to a thumbnail, clicking the thumbnail opens that file in a
// viewer that keeps its own proportions (the theme's zoom would stretch it to the thumbnail's shape).
// Thumbnails without a "_full" file keep the theme's normal click-to-zoom.
//
// The open/close animation is seamless even though the image changes: the viewer starts as the part of
// the full image that the thumbnail shows (clipped and scaled onto the thumbnail) and grows to full size.
// Where a thumbnail lies inside its full image is given below as fractions [left, top, right, bottom].
// A thumbnail that is not listed is treated as the whole image.
var PREVIEW_REGION = {
  "numcolor.png": [372 / 2151, 0 / 1016, 1784 / 2151, 500 / 1016],
};

document.addEventListener("DOMContentLoaded", function () {
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DURATION = reduceMotion ? 0 : 380;
  var EASING = "cubic-bezier(0.2, 0.7, 0.2, 1)";
  var current = null; // { overlay, img, thumb, state }

  // Animation start state: the region of the full image that the thumbnail shows, laid over the thumbnail.
  function startState(thumb, img) {
    var key = thumb.getAttribute("src").split("/").pop().split("?")[0];
    var reg = PREVIEW_REGION[key] || [0, 0, 1, 1];
    var T = thumb.getBoundingClientRect();
    var F = img.getBoundingClientRect();
    var s = T.width / (F.width * (reg[2] - reg[0]));
    var tx = T.left - F.left - s * reg[0] * F.width;
    var ty = T.top - F.top - s * reg[1] * F.height;
    return {
      transform: "translate(" + tx + "px," + ty + "px) scale(" + s + ")",
      clipPath: "inset(" + reg[1] * 100 + "% " + (1 - reg[2]) * 100 + "% " + (1 - reg[3]) * 100 + "% " + reg[0] * 100 + "%)",
    };
  }

  function finish() {
    if (!current) return;
    current.overlay.remove();
    current.thumb.style.visibility = "";
    current = null;
  }

  function close() {
    if (!current || current.closing) return;
    var c = current;
    c.closing = true;
    // Re-measure: the thumbnail may have moved (scroll) while the viewer was open.
    c.thumb.style.visibility = "";
    var from = startState(c.thumb, c.img);
    c.thumb.style.visibility = "hidden";
    var opts = { duration: DURATION, easing: EASING, fill: "forwards" };
    c.bg.animate({ opacity: [1, 0] }, opts);
    var a = c.img.animate(
      [
        { transform: "none", clipPath: "inset(0% 0% 0% 0%)" },
        { transform: from.transform, clipPath: from.clipPath },
      ],
      opts
    );
    a.onfinish = finish;
    if (!DURATION) finish();
  }

  function open(thumb, src) {
    if (current) finish();
    var overlay = document.createElement("div");
    overlay.className = "preview-full-overlay";
    var bg = document.createElement("div"); // backdrop: faded separately so the image itself is opaque from the first frame
    bg.className = "preview-full-bg";
    var img = document.createElement("img");
    img.alt = thumb.alt || "";
    img.style.transformOrigin = "0 0";
    overlay.appendChild(bg);
    overlay.appendChild(img);
    overlay.addEventListener("click", close);
    document.body.appendChild(overlay);
    current = { overlay: overlay, bg: bg, img: img, thumb: thumb };
    img.src = src;
    (img.decode ? img.decode() : Promise.resolve())
      .catch(function () {})
      .then(function () {
        if (current === null || current.img !== img) return;
        var from = startState(thumb, img);
        thumb.style.visibility = "hidden";
        var opts = { duration: DURATION, easing: EASING };
        bg.animate({ opacity: [0, 1] }, opts);
        img.animate(
          [
            { transform: from.transform, clipPath: from.clipPath },
            { transform: "none", clipPath: "inset(0% 0% 0% 0%)" },
          ],
          opts
        );
      });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  document.querySelectorAll(".publications img.preview").forEach(function (thumb) {
    var full = thumb.getAttribute("src").replace(/(\.\w+)$/, "_full$1");
    fetch(full, { method: "HEAD" }).then(function (r) {
      if (!r.ok) return;
      new Image().src = full; // preload, so the viewer opens instantly
      thumb.style.cursor = "zoom-in";
      // Capture phase on the thumbnail itself, so the theme's own zoom never sees the click.
      thumb.addEventListener(
        "click",
        function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          open(thumb, full);
        },
        true
      );
      thumb.removeAttribute("data-zoomable");
    });
  });
});
