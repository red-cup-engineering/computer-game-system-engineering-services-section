;;;; made MUD

(local util (require :util))

(util.make-model :dimension
                            {:conf (require :conf)
                             :systems {:map :mudmap
                                       :mudserver :mud/server
                                       :timer :sys/timer
                                       :webserver :web/server}})
