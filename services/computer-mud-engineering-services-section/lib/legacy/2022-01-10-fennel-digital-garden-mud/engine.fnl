(local util (require :util))

(local thing (require :thing))
(local server (require :server))

(local engine (util.clone-table thing))

(lambda engine.log [engine level message]
  (print (.. level ": " message)))

(lambda engine.make-thing [engine thing]
  (local made-thing (util.clone-table thing))
  (set made-thing.engine engine)
  thing)

(set engine.server (engine:make-thing server))

engine
