(local util (require :util))
(util.merge-models
 (util.load-model :gen/thing)
 {:name "dimension"
  :description "This is a dimension, which is essentially a list of things and the systems that give them functional relationships."
  :things []
  :systems []
  :behaviors [:dimension]
  :log-level :spam
  :log-levels {:critical 1 :error 2 :warning 3
               :info 4 :debug 5 :spam 6}})
