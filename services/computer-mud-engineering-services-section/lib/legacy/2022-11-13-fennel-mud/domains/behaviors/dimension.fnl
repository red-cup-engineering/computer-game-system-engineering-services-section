;;;; dimension behaviors

(local util (require :util))

(fn make-model [dimension model ?addn]
  (util.make-model model ?addn dimension))

(fn ld [dimension] ; avoid overwriting a global function
  "Load DIMENSION: make the systems in its system-list, then load them if they've got a load method."
  (util.log :debug (.. "Loading " (dimension:fname)))
  (each [system-name model-name (pairs dimension.systems)]
    (util.log :debug (.. "Making " system-name " system."))
    (tset dimension system-name (util.make-model model-name))
    (let [s (. dimension system-name)]
      (when s.load
        (s:load dimension))))
  (set dimension.loaded true)
  (util.log :info (.. "Loaded " (dimension:fname))))

(fn start [dimension]
  "Call the start method on any systems within the dimension that have them."
  (if dimension.loaded
      (do
        (util.log :debug (.. "Starting " dimension.name))
        (each [sname _ (pairs dimension.systems)]
          (when (. (. dimension sname) :start)
            (: (. dimension sname) :start)))
        (set dimension.started true)
        (util.log :info (.. "Started " dimension.name)))
      (do
        (util.log :error (.. "Failed to start " dimension.name
                               "; load it first")))))

(fn run [dimension]
  "Call the run method on DIMENSION's timer."
  (if dimension.started
      (if dimension.timer
          (do
            (util.log :info (.. "Running " dimension.name))
            (dimension.timer:run))
          (util.log :error (.. "Failed to run " (dimension:fname)
                               "; no timer system.")))
      (do
        (util.log :error (.. "Failed to run " dimension.name
                               "; start it first")))))

(fn lsr [dimension]
  "Load, start, then run DIMENSION."
  (dimension:load)
  (dimension:start)
  (dimension:run))

{:load ld ; rename it back to load
 : start : run
 : lsr
 : make-model}
