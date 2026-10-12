(local util (require :util))

(util.merge-models
 (util.load-model :gen/system)
 {:name "Fortunes handler"
  :description "This system handles fortunes, short phrases that can be used, say, to fill out small scrolls tucked inside cookies."
  :behaviors [:fortunes-handler]
  :data-file :data/misc/fortunes
  :fortunes []})
