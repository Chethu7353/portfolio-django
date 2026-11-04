(() => {
  'use strict';
  const canvas = document.querySelector('#portrait-canvas');
  const image = document.querySelector('#portrait-source');
  const hero = document.querySelector('.hero');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canvas || !image || !window.THREE) return;

  const mobile = matchMedia('(max-width: 700px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.8));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 100);
  camera.position.z = 10;
  const portrait = new THREE.Group();
  scene.add(portrait);

  let points;
  let material;
  let disposed = false;
  let pageVisible = !document.hidden;
  let frameId = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const clock = new THREE.Clock();

  function buildPortrait() {
    if (!image.naturalWidth || disposed) return;
    const sampleW = mobile ? 240 : 380;
    const sampleH = Math.round(sampleW * image.naturalHeight / image.naturalWidth);
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, sampleW, sampleH);
    let pixels;
    try { pixels = context.getImageData(0, 0, sampleW, sampleH).data; }
    catch (error) { console.error('Could not read the local portrait image.', error); return; }

    const step = mobile ? 4 : 3;
    const maxHeight = mobile ? 5.65 : 6.7;
    const scale = maxHeight / sampleH;
    const positions = [];
    const colors = [];
    const seeds = [];
    let seed = 28391;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let y = 0; y < sampleH; y += step) {
      for (let x = 0; x < sampleW; x += step) {
        const at = (y * sampleW + x) * 4;
        const r = pixels[at], g = pixels[at + 1], b = pixels[at + 2], a = pixels[at + 3];
        const luminance = .2126 * r + .7152 * g + .0722 * b;
        if (a < 90 || luminance < 25) continue;
        positions.push((x - sampleW / 2) * scale, (sampleH / 2 - y) * scale, (random() - .5) * .16);
        const cool = random() > .87;
        const shade = .63 + luminance / 255 * .42;
        colors.push(Math.min(1, shade * (cool ? .80 : 1)), Math.min(1, shade * (cool ? .91 : 1)), Math.min(1, shade * (cool ? 1.13 : 1.05)));
        seeds.push(random(), random(), random());
      }
    }
    if (!positions.length) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 3));
    material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uPointSize: { value: mobile ? 2.0 : 1.8 } },
      vertexShader: `
        attribute vec3 aColor; attribute vec3 aSeed;
        uniform float uTime; uniform float uReveal; uniform vec2 uPointer; uniform float uPointSize;
        varying vec3 vColor; varying float vAlpha;
        void main(){
          vec3 p=position;
          vec3 scatter=vec3((aSeed.x-.5)*4.8,(aSeed.y-.5)*5.2,(aSeed.z-.5)*2.4);
          p=mix(scatter,position,uReveal);
          float drift=sin(uTime*.75+aSeed.x*13.0+aSeed.y*7.0)*.018;
          p.x+=sin(uTime*.36+aSeed.y*9.0)*.018+drift;
          p.y+=cos(uTime*.42+aSeed.x*11.0)*.025;
          p.z+=sin(uTime*.54+aSeed.z*15.0)*.045;
          vec2 d=p.xy-uPointer; float dist=length(d);
          if(dist<1.15){ float push=(1.15-dist)*.12; p.xy+=normalize(d+vec2(.001))*push; }
          vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
          gl_PointSize=uPointSize*(1.0+ aSeed.z*.8)*(10.0/max(1.0,-mv.z));
          vColor=aColor; vAlpha=uReveal*(.72+aSeed.x*.28);
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); if(d>.5) discard;
          float halo=exp(-d*11.0)*.32; float core=1.0-smoothstep(.12,.48,d);
          gl_FragColor=vec4(vColor, (core+halo)*vAlpha);
        }`
    });
    points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    portrait.add(points);
    hero.classList.add('ready');
    runIntro();
    configureScroll();
    animate();
  }

  function runIntro() {
    const heading = document.querySelector('.headline');
    const nav = document.querySelector('.site-header');
    const meta = document.querySelector('.hero-meta');
    const cue = document.querySelector('.hero-bottom');
    if (reduceMotion || !window.gsap) { material.uniforms.uReveal.value = 1; return; }
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
    timeline.fromTo(nav, { y: -14, opacity: 0 }, { y: 0, opacity: 1, duration: .7 }, .05)
      .to(material.uniforms.uReveal, { value: 1, duration: 2.5, ease: 'power2.inOut' }, .2)
      .fromTo(heading, { y: 55, opacity: 0, letterSpacing: '-.04em' }, { y: 0, opacity: 1, letterSpacing: '-.095em', duration: 1.25 }, .85)
      .fromTo(meta, { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: .8 }, 1.45)
      .fromTo(cue, { opacity: 0 }, { opacity: 1, duration: .7 }, 1.8);
  }

  function configureScroll() {
    if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: .8 } })
      .to(portrait.position, { y: .55, duration: 1 }, 0)
      .to(portrait.scale, { x: .91, y: .91, z: .91, duration: 1 }, 0)
      .to(material.uniforms.uReveal, { value: .15, duration: 1 }, 0)
      .to('.hero-copy', { y: '-52%', opacity: .15, duration: 1 }, 0);
  }

  function animate() {
    if (disposed || !pageVisible) return;
    if (!reduceMotion) frameId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    if (material) {
      material.uniforms.uTime.value = elapsed;
      pointer.x += (pointer.tx - pointer.x) * .055;
      pointer.y += (pointer.ty - pointer.y) * .055;
      const viewH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      material.uniforms.uPointer.value.set(pointer.x * viewH * camera.aspect * .5, pointer.y * viewH * .5);
    }
    portrait.rotation.y += ((pointer.tx * .035) - portrait.rotation.y) * .025;
    portrait.rotation.x += ((-pointer.ty * .022) - portrait.rotation.x) * .025;
    renderer.render(scene, camera);
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.35 : 1.8));
    renderer.setSize(innerWidth, innerHeight, false);
  }
  function movePointer(event) {
    if (mobile || reduceMotion) return;
    pointer.tx = (event.clientX / innerWidth - .5) * 2;
    pointer.ty = (.5 - event.clientY / innerHeight) * 2;
  }
  document.addEventListener('pointermove', movePointer, { passive: true });
  document.addEventListener('visibilitychange', () => {
    pageVisible = !document.hidden;
    if (pageVisible) { clock.start(); animate(); }
    else cancelAnimationFrame(frameId);
  });
  window.addEventListener('resize', resize, { passive: true });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); cancelAnimationFrame(frameId); });
  canvas.addEventListener('webglcontextrestored', () => { if (pageVisible) animate(); });
  image.addEventListener('load', buildPortrait, { once: true });
  image.addEventListener('error', () => console.error('Portrait image failed to load:', image.src), { once: true });
  if (image.complete && image.naturalWidth) buildPortrait();

  window.addEventListener('pagehide', () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    if (points) { points.geometry.dispose(); material.dispose(); }
    renderer.dispose();
  }, { once: true });
})();
