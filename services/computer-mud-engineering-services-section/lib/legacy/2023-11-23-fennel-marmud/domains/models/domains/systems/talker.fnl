(local util (require :util))
(util.merge-models
 (util.load-file :gen/system)
 {:name "Talker"
  :description "Talkers are a system for letting users communicate with each other."
  :channels [:one :two]
  :behaviors [:talker]})
