(local util (require :util))
(util.merge-models
 (util.load-model :system)
 {:name "MUDSocket server"})
