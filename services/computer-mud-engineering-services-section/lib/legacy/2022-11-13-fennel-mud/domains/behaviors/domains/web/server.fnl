;;;; Web server behaviors

(local socket (require :socket))

(fn ld [server dimension]
  nil)

(fn start [server]
  (set server.socket (assert (socket.tcp)))
  (assert (server.socket:bind "*" server.web-port))
  (server.socket:listen 2))

(fn tick [server]
  (let [new-conn (server.socket:accept)]
    (when new-conn
      (match (new-conn:receive)
        (_ err) (print (.. "ERR: " err))
        input (new-conn:send "HTTP/1.0 200 OK\nhello world"))))
  (when server.dimension
    (server.dimension.timer:schedule (partial server.tick server))))

{:load ld
 : start
 : tick}
