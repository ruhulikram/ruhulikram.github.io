document.addEventListener("DOMContentLoaded", () => {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;
  const currentYear = document.getElementById("currentYear");

  if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
  }

  setupNavigation(document.getElementById("siteHeader"));
  setupStealthEntry();

  // Without GSAP or with reduced motion, the page stays as plain static HTML.
  const { gsap, ScrollTrigger } = window;
  if (reducedMotion || !gsap || !ScrollTrigger) return;

  document.documentElement.classList.add("has-motion");
  gsap.registerPlugin(
    ...[
      ScrollTrigger,
      window.ScrollSmoother,
      window.DrawSVGPlugin,
      window.Draggable,
      window.InertiaPlugin,
    ].filter(Boolean),
  );

  const smoother =
    window.ScrollSmoother && document.getElementById("smooth-wrapper")
      ? window.ScrollSmoother.create({
          wrapper: "#smooth-wrapper",
          content: "#smooth-content",
          smooth: 1.1,
          effects: true,
          smoothTouch: false,
        })
      : null;

  setupAnchorLinks(smoother);
  setupHeroMotion(gsap);
  setupButterflyMotion(gsap);
  setupProcessMotion(gsap);
  setupProjectMotion(gsap);
  setupTeachingMotion(gsap);
  setupJourneyMotion(gsap);
  setupContactMotion(gsap);
  setupCaseMotion(gsap);

  if (finePointer) {
    setupFolderParallax(gsap);
    setupDraggableProps(gsap);
    setupMagneticButtons(gsap);
  }

  // Triggers were created per section, not in page order; sort so pin spacing
  // from earlier sections is accounted for in later ones.
  ScrollTrigger.sort();

  const settle = () => {
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    scrollToHash(smoother, window.location.hash, false);
  };
  if (document.fonts?.ready) {
    document.fonts.ready.then(settle);
  } else {
    window.addEventListener("load", settle);
  }
});

function setupNavigation(siteHeader) {
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  const observedSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let lastScrollY = window.scrollY;
  let ticking = false;

  const updateHeader = () => {
    const currentScrollY = window.scrollY;
    const scrollingDown =
      currentScrollY > lastScrollY &&
      currentScrollY > 180 &&
      !siteHeader?.matches(":focus-within");

    siteHeader?.classList.toggle("is-hidden", scrollingDown);
    lastScrollY = currentScrollY;
    ticking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    },
    { passive: true },
  );

  siteHeader?.addEventListener("focusin", () =>
    siteHeader.classList.remove("is-hidden"),
  );

  if (!("IntersectionObserver" in window)) return;

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries.find((entry) => entry.isIntersecting);
      if (!visibleEntry) return;

      navLinks.forEach((link) => {
        if (link.getAttribute("href") === `#${visibleEntry.target.id}`) {
          link.setAttribute("aria-current", "true");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );

  observedSections.forEach((section) => sectionObserver.observe(section));
}

// ScrollSmoother moves the content with transforms, so in-page links have to
// go through it instead of the browser's native jump.
function setupAnchorLinks(smoother) {
  if (!smoother) return;

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      if (!scrollToHash(smoother, hash, true)) return;
      event.preventDefault();
      window.history.pushState(null, "", hash);
    });
  });
}

function scrollToHash(smoother, hash, smooth) {
  if (!smoother || !hash || hash === "#") return false;

  let target;
  try {
    target = document.querySelector(decodeURIComponent(hash));
  } catch {
    return false;
  }
  if (!target) return false;

  smoother.scrollTo(target, smooth, "top 80px");
  return true;
}

// Chalk strokes draw themselves; the handwritten label is written on the mat
// already, so it stays put.
function drawChalk(gsap, container) {
  const tl = gsap.timeline();
  const strokes = container?.querySelectorAll(".chalk");
  if (window.DrawSVGPlugin && strokes?.length) {
    tl.from(strokes, {
      drawSVG: 0,
      duration: 0.6,
      stagger: 0.2,
      ease: "power1.inOut",
    });
  }
  return tl;
}

// Nothing on a desk appears out of thin air. Objects are pushed in from past
// the edge of the screen, so these return a start offset just off-screen.
const offRight = (el) => () =>
  window.innerWidth - el.getBoundingClientRect().left + 60;
const offLeft = (el) => () => -(el.getBoundingClientRect().right + 60);

// Pushed onto the desk from one side, with a little spin, as a scroll reveal.
function slideOnto(gsap, el, side, vars = {}) {
  if (!el) return;
  gsap.from(el, {
    x: side === "left" ? offLeft(el) : offRight(el),
    rotation: side === "left" ? -12 : 12,
    duration: 0.9,
    ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 88%", once: true },
    ...vars,
  });
}

function setupHeroMotion(gsap) {
  const folder = document.querySelector(".folder-asset");
  if (!folder) return;

  const pencil = document.querySelector(".prop-pencil");
  const eraser = document.querySelector(".prop-eraser");

  // The folder slides in from the right edge, then the files rise out of it.
  const tl = gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from(folder, { x: offRight(folder), rotation: 14, duration: 1.1 })
    .from(
      ".file-interactive",
      { y: 60, stagger: 0.09, duration: 0.6, clearProps: "transform" },
      0.75,
    );

  if (pencil) {
    tl.from(pencil, { x: offLeft(pencil), rotation: -70, duration: 1 }, 0.3);
  }
  if (eraser) {
    tl.from(eraser, { x: offRight(eraser), rotation: 120, duration: 1 }, 0.45);
  }
  tl.add(drawChalk(gsap, document.querySelector(".chalk-note--hero")), 1.2);

  // On wide screens the hero holds briefly while the files lift out further.
  gsap.matchMedia().add("(min-width: 981px)", () => {
    gsap.to(".folder-files-layer", {
      yPercent: -14,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=300",
        pin: true,
        scrub: 0.6,
      },
    });
  });
}

function setupButterflyMotion(gsap) {
  const hero = document.querySelector(".hero");
  const butterflies = gsap.utils.toArray("[data-butterfly]");

  if (!hero || !butterflies.length) return;

  const configs = {
    primary: {
      scale: 0.82,
      rotation: 18,
      exitX: 1.45,
      exitY: -0.4,
      exitRotation: 45,
      liftOffset: [0.08, -0.1],
    },
    drift: {
      scale: 0.95,
      rotation: -24,
      exitX: -0.45,
      exitY: 1.3,
      exitRotation: -65,
      liftOffset: [-0.12, 0.1],
    },
    dart: {
      scale: 0.72,
      rotation: -12,
      exitX: 1.35,
      exitY: 1.25,
      exitRotation: 30,
      liftOffset: [0.1, 0.08],
    },
  };

  butterflies.forEach((butterfly) => {
    const config = configs[butterfly.dataset.flight] || configs.primary;
    const leftWing = butterfly.querySelector(".paper-butterfly__wing--left");
    const rightWing = butterfly.querySelector(".paper-butterfly__wing--right");
    const shadow = butterfly.querySelector(".paper-butterfly__shadow");

    if (!leftWing || !rightWing || !shadow) return;

    gsap.set(butterfly, {
      x: 0,
      y: 0,
      xPercent: -50,
      yPercent: -50,
      rotation: config.rotation,
      scale: config.scale,
    });
    gsap.set(leftWing, {
      rotationY: 15,
      rotationZ: -15,
      transformOrigin: "100% 50%",
    });
    gsap.set(rightWing, {
      rotationY: -15,
      rotationZ: 15,
      transformOrigin: "0% 50%",
    });

    const idleFlap = gsap.timeline({
      repeat: -1,
      repeatDelay: 1.4 + Math.random() * 1.2,
    });
    idleFlap
      .to(leftWing, { rotationY: -55, duration: 0.13, ease: "sine.inOut" }, 0)
      .to(rightWing, { rotationY: 55, duration: 0.13, ease: "sine.inOut" }, 0)
      .to(leftWing, { rotationY: -15, duration: 0.18, ease: "sine.out" }, 0.13)
      .to(rightWing, { rotationY: 15, duration: 0.18, ease: "sine.out" }, 0.13);

    const flight = gsap.timeline({
      scrollTrigger: {
        trigger: hero,
        start: "top top",
        end: "+=350",
        scrub: 0.3,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (self.progress > 0.05) {
            idleFlap.pause();
          } else {
            idleFlap.resume();
          }
        },
      },
    });

    [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84].forEach((pos) => {
      flight
        .to(leftWing, { rotationY: -74, duration: 0.05, ease: "power1.in" }, pos)
        .to(rightWing, { rotationY: 74, duration: 0.05, ease: "power1.in" }, pos)
        .to(leftWing, { rotationY: -10, duration: 0.07, ease: "power1.out" }, pos + 0.05)
        .to(rightWing, { rotationY: 10, duration: 0.07, ease: "power1.out" }, pos + 0.05);
    });

    // They fly off past the edge of the hero rather than fading out.
    flight
      .to(
        butterfly,
        {
          x: () => hero.clientWidth * config.liftOffset[0],
          y: () => hero.clientHeight * config.liftOffset[1],
          rotation: config.rotation + (config.exitX < 0 ? -25 : 25),
          duration: 0.22,
          ease: "power1.out",
        },
        0,
      )
      .to(shadow, { scale: 0.1, duration: 0.18 }, 0)
      .to(
        butterfly,
        {
          x: () => hero.clientWidth * config.exitX - butterfly.offsetLeft,
          y: () => hero.clientHeight * config.exitY - butterfly.offsetTop,
          rotation: config.exitRotation,
          scale: config.scale * 0.6,
          duration: 0.78,
          ease: "power2.in",
        },
        0.22,
      );
  });
}

function setupProcessMotion(gsap) {
  const section = document.getElementById("proses");
  if (!section) return;

  const notes = gsap.utils.toArray(".process-note");
  const strokes = gsap.utils.toArray(".process-arrows .chalk");
  const mm = gsap.matchMedia();

  // Wide screens: the board pins and the notes are dealt onto it one by one,
  // each pinned down before the next arrives.
  mm.add("(min-width: 981px)", () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: section,
        start: () =>
          section.offsetHeight > window.innerHeight
            ? "bottom bottom"
            : "center center",
        end: "+=900",
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });

    notes.forEach((note, i) => {
      const at = i * 1.1;
      tl.from(
        note,
        {
          x: offRight(note),
          rotation: gsap.utils.random(8, 20),
          duration: 1,
          ease: "power2.out",
        },
        at,
      ).from(
        note.querySelector(".pin"),
        { y: -20, scale: 1.3, duration: 0.3, ease: "power2.in" },
        at + 0.8,
      );

      const arrow = strokes.slice(i * 2, i * 2 + 2);
      if (window.DrawSVGPlugin && arrow.length) {
        tl.from(arrow, { drawSVG: 0, duration: 0.5, stagger: 0.25 }, at + 0.9);
      }
    });
  });

  mm.add("(max-width: 980px)", () => {
    notes.forEach((note, i) => slideOnto(gsap, note, i % 2 ? "right" : "left"));
  });
}

function setupProjectMotion(gsap) {
  const section = document.getElementById("proyek");
  const track = section?.querySelector(".project-track");
  if (!track) return;

  const cards = gsap.utils.toArray(".project-card");
  const mm = gsap.matchMedia();

  // Wide screens: the section pins and the sheets slide across the desk.
  mm.add("(min-width: 981px)", () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const slide = gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${distance() + window.innerHeight * 0.15}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });

    // Each binder clip snaps shut as its sheet reaches the middle of the desk.
    cards.forEach((card) => {
      gsap.from(card.querySelector(".binder-clip"), {
        y: -14,
        scale: 1.25,
        rotation: -12,
        duration: 0.35,
        ease: "back.out(3)",
        scrollTrigger: {
          trigger: card,
          containerAnimation: slide,
          start: "left 70%",
          toggleActions: "play none none reverse",
        },
      });
    });
  });

  mm.add("(max-width: 980px)", () => {
    cards.forEach((card, i) => slideOnto(gsap, card, i % 2 ? "right" : "left"));
  });
}

function setupTeachingMotion(gsap) {
  const card = document.querySelector(".index-card");
  const polaroids = gsap.utils.toArray(".polaroid");
  if (!card && !polaroids.length) return;

  const tl = gsap.timeline({
    defaults: { ease: "power3.out" },
    scrollTrigger: { trigger: "#mengajar", start: "top 65%", once: true },
  });

  if (card) {
    tl.from(card, { x: offLeft(card), rotation: -10, duration: 0.9 });
  }

  // Photos are tossed in from the top-right, then the tape is pulled across.
  polaroids.forEach((photo, i) => {
    tl.from(
      photo,
      {
        x: offRight(photo),
        y: -160,
        rotation: gsap.utils.random(20, 40),
        duration: 0.9,
      },
      0.15 + i * 0.18,
    ).from(
      photo.querySelector(".tape"),
      { scaleX: 0.3, transformOrigin: "left center", duration: 0.3 },
      0.9 + i * 0.18,
    );
  });
}

function setupJourneyMotion(gsap) {
  gsap.utils.toArray(".slip").forEach((slip) => slideOnto(gsap, slip, "right"));
  slideOnto(gsap, document.querySelector(".cert"), "right", { rotation: 30 });
}

function setupContactMotion(gsap) {
  const letter = document.querySelector(".letter");
  if (!letter) return;

  // The sketchbook is slid up from the bottom edge, then clipped down. The
  // trigger is the section, since the letter itself starts a screen lower.
  gsap
    .timeline({
      defaults: { ease: "power3.out" },
      scrollTrigger: { trigger: "#kontak", start: "top 70%", once: true },
    })
    .from(letter, {
      y: () => window.innerHeight,
      rotation: 8,
      duration: 1,
    })
    .from(
      letter.querySelector(".letter-clip"),
      { y: -16, scale: 1.25, duration: 0.35, ease: "back.out(3)" },
      0.85,
    )
    .add(drawChalk(gsap, document.querySelector(".chalk-note--contact")), 0.9);

  // The paper ball rolls in from the right.
  const ball = document.querySelector(".prop-paperball");
  if (ball) {
    gsap.from(ball, {
      x: offRight(ball),
      rotation: -540,
      duration: 1.2,
      ease: "power2.out",
      scrollTrigger: { trigger: ball, start: "top 95%", once: true },
    });
  }
}

function setupCaseMotion(gsap) {
  if (!document.querySelector(".case")) return;

  // Fact cards are dealt in on load, alternating sides.
  gsap.utils.toArray(".case-facts > div").forEach((fact, i) => {
    gsap.from(fact, {
      x: i % 2 ? offRight(fact) : offLeft(fact),
      rotation: i % 2 ? 12 : -12,
      duration: 0.9,
      delay: i * 0.08,
      ease: "power3.out",
    });
  });

  gsap.utils.toArray(".case-media, .case-story").forEach((block, i) =>
    slideOnto(gsap, block, i % 2 ? "left" : "right"),
  );
}

function setupFolderParallax(gsap) {
  const stage = document.getElementById("folderStage");
  const folder = document.getElementById("mainFolder");
  if (!stage || !folder) return;

  const rotateX = gsap.quickTo(folder, "rotationX", { duration: 0.5, ease: "power3.out" });
  const rotateY = gsap.quickTo(folder, "rotationY", { duration: 0.5, ease: "power3.out" });

  stage.addEventListener("pointermove", (event) => {
    const bounds = stage.getBoundingClientRect();
    rotateY(((event.clientX - bounds.left) / bounds.width - 0.5) * 7);
    rotateX(((event.clientY - bounds.top) / bounds.height - 0.5) * -5);
  });

  stage.addEventListener("pointerleave", () => {
    rotateX(0);
    rotateY(0);
  });
}

// Pencils, erasers and paper balls can be pushed around the desk.
function setupDraggableProps(gsap) {
  const { Draggable } = window;
  const props = gsap.utils.toArray(".desk-prop--drag");
  if (!Draggable || !props.length) return;

  document.documentElement.classList.add("has-drag");

  props.forEach((prop) => {
    Draggable.create(prop, {
      type: "x,y",
      bounds: prop.closest("section"),
      inertia: Boolean(window.InertiaPlugin),
      onPress() {
        gsap.to(prop, { scale: 1.08, duration: 0.2 });
      },
      onRelease() {
        gsap.to(prop, { scale: 1, duration: 0.35, ease: "back.out(2)" });
      },
    });
  });
}

function setupMagneticButtons(gsap) {
  gsap.utils.toArray(".button--primary").forEach((button) => {
    const moveX = gsap.quickTo(button, "x", { duration: 0.4, ease: "power3.out" });
    const moveY = gsap.quickTo(button, "y", { duration: 0.4, ease: "power3.out" });

    button.addEventListener("pointermove", (event) => {
      const bounds = button.getBoundingClientRect();
      moveX((event.clientX - bounds.left - bounds.width / 2) * 0.25);
      moveY((event.clientY - bounds.top - bounds.height / 2) * 0.35);
    });

    button.addEventListener("pointerleave", () => {
      moveX(0);
      moveY(0);
    });
  });
}

function setupStealthEntry() {
  let clicks = 0;
  let timer = null;
  const trigger = document.getElementById("mainFolder");
  const go = () => {
    window.location.href = "404.html#unlock";
  };

  trigger?.addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    clicks++;
    clearTimeout(timer);
    if (clicks >= 5) {
      clicks = 0;
      go();
    } else {
      timer = setTimeout(() => {
        clicks = 0;
      }, 2200);
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      go();
    }
  });
}
