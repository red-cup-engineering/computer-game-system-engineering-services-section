(local util (require :util))

(util.clone-table
 (require :thing)
 {:name "MarMUD"
  :conf (require :conf)
  :log-levels {:critical 1 :error 2
               :warning 3 :info 4
               :debug 5 :spam 6}
  :log
  (fn [engine level message]
    (local time (os.time))
    (fn print-msg []
      (when (not (= engine.last-log-print time))
        (set engine.last-log-print time)
        (print (util.render-time time)))
      (print (.. level
                 (if (= level :error) ":    "
                     (if (= level :warning) ":  "
                         (if (= level :info) ":     "
                             (if (= level :debug) ":    "
                                 (if (= level :spam) ":     "
                                     ": ")))))
                 message)))
    (when (>= (. engine.log-levels engine.conf.log-level)
              (. engine.log-levels level))
      (print-msg)))
  :load
  (fn [engine]
    (set engine.name (or engine.conf.name "engine"))
    (engine:log :debug (.. "Loading " engine.name))
    ;; add modules
    (each [_ mod (pairs [:map :server :users :timer])]
      (tset engine mod (util.clone-table (require mod))))
    ;; load those that should be
    (each [_ mod (pairs [:map :server :users])]
      (: (. engine mod) :load engine))
    (set engine.loaded true)
    (engine:log :info (.. "Loaded " engine.name)))
  :start
  (fn [engine]
    (if engine.loaded
        (do
          (engine:log :debug (.. "Starting " engine.name))
          (each [_ mod (pairs [:map :server])]
            (: (. engine mod) :start))
          (set engine.started true)
          (engine:log :info (.. "Started " engine.name)))
        (do
          (engine:log :error (.. "Failed to start " engine.name
                                 "; load it first")))))
  :run
  (fn [engine]
    (if engine.started
        (do
          (engine:log :debug (.. "Running " engine.name))
          (engine.timer:run))
        (do
          (engine:log :error (.. "Failed to run " engine.name
                                 "; start it first")))))
  :lsr
  (fn [engine]
    (engine:load)
    (engine:start)
    (engine:run))})
