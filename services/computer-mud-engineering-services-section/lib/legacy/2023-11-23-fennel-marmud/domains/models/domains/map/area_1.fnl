(local util (require :util))
(util.merge-models
 (util.load-model :gen/container)
 {:name :area
  :grammar {:article :an}
  :description "This is an area, a place where things can be."
  :behaviors [:area]
  :contents []
  :exits {}})
