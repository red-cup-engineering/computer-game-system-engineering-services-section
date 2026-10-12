;;;; mudsocket server behaviors

(local util (require :util))
(local socket (require :socket))

(local mud-server-behaviors {})

(fn mud-server-behaviors.accept-connection [server connection]
  (connection:settimeout server.timeout)
  (let [client (util.make-model
                :mud/client
                {: connection : server
                 :dimension server.dimension})]
    (table.insert server.clients client)
    (client:message
     (.. "Your connection to " (server:fname) " has been accepted.\n"
         (server:describe) "\n"
         (server.dimension:describe) "\n"))
    (client:parse "help")
    (when (and client.dimension.map
               client.dimension.conf.start-area)
      (client:move
       (client.dimension.map:find-area client.dimension.conf.start-area)))
    (set client.input-ready? true)))

(fn mud-server-behaviors.disconnect-client [server client]
  (client:message (.. "Disconnecting you now; goodbye!"))
  (client.connection:close)
  (util.remove-value server.clients client))

(fn mud-server-behaviors.load [server dimension]
  (util.log :debug (.. "Loading " server.name))
  (set server.dimension dimension)
  (set server.loaded true)
  (util.log :debug (.. "Loaded " server.name)))

(fn mud-server-behaviors.start [server]
  (util.log :debug (.. "Starting " server.name))
  (if server.loaded
      (do
        (local port (or server.port 4242))
        (util.log :debug (.. "Starting " server.name
                                      " on port " port))
        (set server.socket (assert (socket.bind "0.0.0.0" port)))
        (server.socket:settimeout (or server.timeout 0.001))
        (server.dimension.timer:schedule
          (partial server.tick server true))
        (util.log :info (.. "Started " server.name
                                     " on port " port)))
      (util.log :error (.. "Failed to start " server.name
                                    "; load it first"))))

(fn mud-server-behaviors.tick [server ?repeat]
  (let [new-conn (server.socket:accept)]
    (when new-conn
      (util.log :debug (.. "Accepting new connection."))
      (server:accept-connection new-conn)))
  (each [_ client (pairs server.clients)]
    (var inputted? nil)
    (match (client.connection:receive)
      (_ "timeout") nil
      (_ err) (server:disconnect-client client err)
      input (do (client:parse input)
                (set client.input-ready? true)))
    (when (not (= (length client.buffer) 0))
      (util.log :debug (.. "Sending message to "
                                    client.name ": "
                                    (: client.buffer :sub 0 32)
                                    (if (> (length client.buffer) 12)
                                        "..."
                                        "")))
      ;; strip extra newlines from the end of output here? seems better than trying to avoid them accruing lol
      (client.connection:send
       (.. client.buffer (if client.input-ready? "\n> " "")))
      (set client.buffer "")
       (set client.input-ready? nil)))
  (when ?repeat
    (server.dimension.timer:schedule
     (partial server.tick server true))))

mud-server-behaviors
