(local util (require :util))
(util.merge-models
 (util.load-model :gen/system)
 {:name "Users Handler"
  :behaviors [:users-handler]
  :user-data {}})
