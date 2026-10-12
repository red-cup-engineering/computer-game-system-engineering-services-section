(local util (require :util))
(util.merge-models
 (util.load-model :system)
 {:name "MUDSocket server"
  :behaviors [:server]
  :port 4242
  :timeout 0.001
  :clients []})
