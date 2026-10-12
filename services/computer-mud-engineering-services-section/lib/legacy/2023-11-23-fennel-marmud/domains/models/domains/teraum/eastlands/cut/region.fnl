(local util (require :util))
(util.merge-models
 (util.load-model :map/region)
 {:name "Cut"})
