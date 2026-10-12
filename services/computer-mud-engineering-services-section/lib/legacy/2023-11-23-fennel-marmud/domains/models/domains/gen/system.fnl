(local util (require :util))

(util.merge-models
 (util.load-model :thing)
 {:name "MUD system"})
