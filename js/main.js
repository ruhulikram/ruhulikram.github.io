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

  if (!reducedMotion && window.gsap && window.ScrollTrigger) {
    setupMotion(finePointer);
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

// The one orchestrated moment: the folder lands on the mat, then the
// butterflies take off as the visitor scrolls away from it.
function setupMotion(finePointer) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);

  gsap
    .timeline({ defaults: { ease: "power3.out" } })
    .from(".hero-copy > *", {
      y: 24,
      autoAlpha: 0,
      stagger: 0.08,
      duration: 0.7,
      clearProps: "all",
    })
    .from(
      ".folder-asset",
      { y: -60, rotation: -4, scale: 1.06, autoAlpha: 0, duration: 0.9 },
      0.1,
    )
    .from(
      ".file-interactive",
      { y: 50, autoAlpha: 0, stagger: 0.09, duration: 0.6, clearProps: "all" },
      0.55,
    );

  setupButterflyMotion(gsap);

  if (finePointer) {
    setupFolderParallax(gsap);
  }
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
        end: "top -350px",
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
      .to(shadow, { autoAlpha: 0, scale: 0.1, duration: 0.18 }, 0)
      .to(
        butterfly,
        {
          x: () => hero.clientWidth * config.exitX - butterfly.offsetLeft,
          y: () => hero.clientHeight * config.exitY - butterfly.offsetTop,
          rotation: config.exitRotation,
          scale: config.scale * 0.35,
          autoAlpha: 0,
          duration: 0.78,
          ease: "power2.in",
        },
        0.22,
      );
  });
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
