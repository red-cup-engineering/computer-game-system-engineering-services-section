;; Guix package definitions for a real analysis engine behind this
;; section's GTP and KataGo JSON analysis protocol client
;; (src/go-engine.mjs): KataGo itself, built from its v1.18.2 GitHub
;; release source with the portable Eigen (CPU) backend, and one small
;; officially-distributed neural network (kata1-b6c96, the smallest
;; architecture katagotraining.org distributes) to run it against.  Lives
;; beside the service it packages; module name is derived mechanically
;; from the repository path (load with `-L <repository root>`), and the
;; file is also loadable directly:
;; `guix build -L . -f go-engine.scm` through the Guix machine-service runner.
;;
;; Per org-layering.md item 7: this is the Guix (dev/prod) layer, packaging
;; a real toolchain KataGo binary and a real network weights file — never a
;; .scm that performatively wraps a Node package. Node custody (the GTP and
;; analysis-protocol *client*, src/go-engine.mjs) stays where it is; this
;; file supplies the external engine binary and model that client spawns
;; as a subprocess, per the section README's "Running against a real
;; engine".
(define-module (lib emsenn services 561-group services engineering-services-section services computer-engineering-services-section services computer-systems-engineering-services-section services computer-game-system-services-section services go-engine-services-section go-engine)
  #:use-module (guix packages)
  #:use-module (guix gexp)
  #:use-module (guix download)
  #:use-module (guix utils)
  #:use-module (guix build-system cmake)
  #:use-module (guix build-system trivial)
  #:use-module ((guix licenses) #:prefix license:)
  #:use-module (gnu packages algebra)
  #:use-module (gnu packages compression)
  #:use-module (gnu packages pkg-config)
  #:export (katago-eigen-package
            katago-network-b6c96-package))

;; KataGo v1.18.2's GitHub release source tarball (the whole repository at
;; that tag; the engine itself lives under cpp/). Hash verified with
;; `guix download` against this exact URL.
(define katago-source
  (origin
    (method url-fetch)
    (uri "https://github.com/lightvector/KataGo/archive/refs/tags/v1.18.2.tar.gz")
    (sha256
     (base32
      "1ycb5xvkfs5xz3xv0ddi8lsk13ggg9y7cfmcjw6s1nphz95mbzgy"))
    (file-name "katago-1.18.2.tar.gz")))

(define-public (katago-eigen-package)
  (package
    (name "katago-eigen")
    (version "1.18.2")
    (source katago-source)
    (build-system cmake-build-system)
    (arguments
     (list
      ;; The test suite needs GPU backends and bundled fixture models this
      ;; package does not carry; conformance for this package is the live
      ;; GTP/analysis verification run separately against the built binary.
      #:tests? #f
      #:configure-flags
      #~(list "-DUSE_BACKEND=EIGEN"
              ;; Portable CPU build: no AVX2/FMA specialization, so the
              ;; resulting binary runs on any x86_64-linux machine, not
              ;; only ones matching the build host's own CPU features
              ;; (Compiling.md: "-DUSE_AVX2=1 ... will make it incompatible
              ;; with old CPUs").
              "-DNO_GIT_REVISION=1"
              "-DCMAKE_BUILD_TYPE=Release")
      #:phases
      #~(modify-phases %standard-phases
          ;; KataGo's CMakeLists.txt lives in cpp/, not the repository
          ;; root. cmake-build-system's phases operate against the current
          ;; working directory at configure time, so chdir there right
          ;; after unpack makes cpp/ the effective source directory for
          ;; every later phase.
          (add-after 'unpack 'chdir-to-cpp
            (lambda _
              (chdir "cpp")))
          ;; Upstream's CMakeLists.txt defines no install() rule at all —
          ;; Compiling.md's own instructions just say "you should now have
          ;; a compiled katago executable in your working directory".
          ;; Install the binary, and the example GTP/analysis configs this
          ;; package's live verification needs, by hand.
          (replace 'install
            (lambda* (#:key outputs #:allow-other-keys)
              (let* ((out (assoc-ref outputs "out"))
                     (bin (string-append out "/bin"))
                     (share (string-append out "/share/katago")))
                (mkdir-p bin)
                (install-file "katago" bin)
                (mkdir-p share)
                ;; cwd here is the out-of-source build directory, a sibling
                ;; of cpp/ (both directly under the unpacked source root).
                (copy-recursively "../cpp/configs"
                                   (string-append share "/configs"))))))))
    (inputs (list eigen zlib libzip))
    (native-inputs (list pkg-config))
    (home-page "https://github.com/lightvector/KataGo")
    (synopsis
     "KataGo Go/weiqi engine (Eigen CPU backend), GTP and JSON analysis protocols")
    (description
     "KataGo, built from its v1.18.2 GitHub release source with the
portable Eigen (CPU-only) backend (USE_BACKEND=EIGEN, no AVX2
specialization).  Speaks both GTP (Go Text Protocol version 2, via `katago
gtp`) and KataGo's own line-delimited JSON analysis-engine protocol (via
`katago analysis`) over a child process's stdin/stdout — the two outside
engine protocols go-engine-services-section's src/go-engine.mjs client
reaches an engine through.  Ships example GTP and analysis configs under
share/katago/configs.")
    (license license:expat)))

;; The smallest architecture katagotraining.org distributes for the kata1
;; run (6 residual blocks, 96 channels), at its final (most-trained)
;; checkpoint — the network TrainingHistory.md itself names as the "last
;; selfplay 6 block" net of the third major (g170) run. Hash verified with
;; `guix download` against this exact URL.
(define katago-network-b6c96-source
  (origin
    (method url-fetch)
    (uri "https://media.katagotraining.org/uploaded/networks/models/kata1/kata1-b6c96-s175395328-d26788732.txt.gz")
    (sha256
     (base32
      "1jszzbwcrf8p789xxvmaba8mx7m4aw4s8p3apyalyxf4wd6pbmj8"))
    (file-name "kata1-b6c96-s175395328-d26788732.txt.gz")))

(define-public (katago-network-b6c96-package)
  (package
    (name "katago-network-b6c96")
    (version "s175395328-d26788732")
    (source katago-network-b6c96-source)
    ;; trivial-build-system, not copy-build-system: copy-build-system
    ;; inherits gnu-build-system's default 'unpack phase, which for any
    ;; non-tarball single-file source with a recognized compressor
    ;; extension (.gz here) DECOMPRESSES it in place before the 'install
    ;; phase ever runs (see gnu-build-system.scm's unpack: "copy-file
    ;; source name" then "invoke command --decompress name") — silently
    ;; turning our gzip-compressed model into a plain-text one and
    ;; renaming it out from under any install-plan naming the original
    ;; .txt.gz. A direct gexp copy of the origin (the same shape
    ;; koios-news.scm's own local-file copies use) sidesteps that
    ;; unpack machinery entirely and keeps the file byte-identical to
    ;; what was hashed.
    (build-system trivial-build-system)
    (arguments
     (list
      #:modules '((guix build utils))
      #:builder
      #~(begin
          (use-modules (guix build utils))
          (let ((dir (string-append #$output "/share/katago/networks")))
            (mkdir-p dir)
            (copy-file #$katago-network-b6c96-source
                       (string-append dir "/kata1-b6c96-s175395328-d26788732.txt.gz"))))))
    (home-page "https://katagotraining.org/networks/kata1/")
    (synopsis "Smallest official KataGo kata1 network (6 blocks, 96 channels)")
    (description
     "The kata1-b6c96-s175395328-d26788732 neural network: KataGo's kata1
distributed-training run's smallest architecture (6 residual blocks, 96
channels), at its final imported (g170) checkpoint.  Small enough to run
analysis with on CPU (the Eigen backend) at usable speed; weak in playing
strength relative to KataGo's large production nets, which is not this
package's purpose — it exists to give the Eigen-backend katago package a
real, small, officially-distributed model to load and analyze with.")
    (license license:expat)))

;; Loadable-file entry: evaluating this file yields both packages, so
;; `guix build -L . -f go-engine.scm` builds both in one invocation.
(list (katago-eigen-package) (katago-network-b6c96-package))
