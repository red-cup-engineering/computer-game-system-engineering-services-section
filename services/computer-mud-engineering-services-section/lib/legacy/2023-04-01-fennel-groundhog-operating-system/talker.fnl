(local util (require :util))

(util.clone-table
 (require :thing)
 {:name :Talker
  :description "This is the Talker service."
  :broadcast
  (fn [talker chatter message]
    nil)})
