;;; Groundhog Operating System
(local gos
       {:dep {:fennel (require :fennel)
              :socket (require :socket)}
        :computer {}
        :model {}
        :util {}})
;;;; Utilities
(lambda gos.util.collect-keys [tbl]
  "Return a list of the keys in TBL."
  (icollect [key _ (pairs tbl)] key))
(lambda gos.util.load [path ?fallback]
  (let [load-file (io.open (.. path ".fnl") :r)]
    (if load-file
        (let [loaded-data (load-file:read "*all")]
          (gos.dep.fennel.eval loaded-data))
        (if ?fallback
            (do
              (gos.util.save ?fallback path)
              (gos.util.load path))
            (print (.. "No file at " path
                       " and no fallback given. Failed to load."))))))
(lambda gos.util.make-id [?existing]
  "Generates an ID, dismissing it if its already in EXISTING."
  (lambda f [x]
    (var r (- (math.random 16) 1))
    (set r (or (and (= x :x) (+ r 1)) (+ (% r 4) 9)))
    (: :0123456789abcdef :sub r r))
  (let [gen (: :xxxxxxxx :gsub "[xy]" f)]
    (when ?existing
      (each [_ id (pairs ?existing)]
        (when (= gen id)
          (gos.util.make-id ?existing))))
    gen))
(lambda gos.util.make-string-appender [?sep]
  "Return a function that holds a string and accepts one atctional argument (string or list of strings). If provided, the argument is appended to the held string, with SEP appended (to each one, if its a list of strings.)"
  (var o "")
  (lambda [?a]
    (lambda q [r]
      (set o (.. o r (or ?sep ""))) o)
    (if ?a
        (if (= (type ?a) :string)
              (q ?a)
              (each [_ v (pairs ?a)]
                (q v)))
        o)))
(lambda gos.util.make-string-inserters [str]
  {:P (lambda [p] (.. p str))
   :I (lambda [p s] (.. p str s))
   :S (lambda [s] (.. str s))})
(lambda gos.util.quibble-strings [strings ?resort ?oxfordize]
  "Return the sequence of STRINGS separated with commas and the conjunction 'and'. ?OXFORDIZE is currently irrelevant; strings are oxfordized by defualt."
  (let [oxfordize (or ?oxfordize true)
        o (gos.util.make-string-appender)]
    (when ?resort (table.sort strings))
    (var join "")
    (for [count 1
          (length strings) 1]
      (if (= count (length strings))
          (set join "")
          (= count (- (length strings) 1))
          (set join
               (.. (if (and oxfordize
                            (> (length strings) 2))
                       ","
                       "")
                   " and "))
          (set join ", "))
      (o [(. strings count) join]))
    (o)))
(lambda gos.util.render-time [time]
  (os.date "%Y%m%d:%H%M" time))
(lambda gos.util.save [data path]
  (let [save-file (io.open (.. path ".fnl") :w)]
    (save-file:write (gos.dep.fennel.view data))
    (save-file:close)))
;;;; Models
(lambda gos.model.basic-thing [?base ?attributes]
  "Make a basic thing."
  (let [thing (or ?base {})]
    (lambda thing.remove-attribute [thing attr]
      "Remove ATTR from THING"
      (tset thing attr nil))
    (lambda thing.set-attribute [thing attr val]
      (tset thing attr val))
    (lambda thing.set-attributes [thing attrs]
      (each [attr val (pairs attrs)]
        (tset thing attr val)))
    (when ?attributes (thing:set-attributes ?attributes))
    thing))
(lambda gos.model.changelog [?file-name ?name ?base]
  (let [name (or ?name :changelog)
        file-name (or ?file-name name)
        changelogger (gos.model.log file-name name ?base)
        I (gos.util.make-string-inserters name)]
    (tset changelogger (I.I :make- :-entry)
          (lambda make-changelog-entry [logger author status element ?note]
            "Makes a new changelog entry for LOGGER."
            {:time (os.time)
             : author
             : status
             : element
             :note (or ?note nil)}))
    (tset changelogger (I.I :render- :-entry)
          (lambda render-changelog-entry [logger entry]
            (.. entry.status " " entry.element
                (if (. entry :note)
                    (.. " (" entry.note ")")
                    "")
                " [" entry.author " @ " (gos.util.render-time entry.time) "]")))
    (tset changelogger (I.P :render-)
          (lambda render-changelog [logger]
            (let [entries (: logger (I.P :load-))
                  A (gos.util.make-string-appender "\n")]
              (each [_ entry (pairs entries)]
                (A (: logger (I.I :render- :-entry) entry)))
              (A))))
    changelogger))
(lambda gos.model.data [?file-name ?name ?base ?default]
  (let [handler (or ?base (gos.model.basic-thing))
        name (or ?name :data)
        name-file (.. name :-file)
        file (if (. handler :folder-name)
                 (.. handler.folder-name "/" name)
                 name)
        default (or ?default nil)
        I (gos.util.make-string-inserters name)]
    (tset handler name-file file)
    (tset handler (I.P :load-)
          (lambda load-data [handler ?file ?default]
            (gos.util.load (or ?file (. handler name-file))
                           (or ?default default))))
    (tset handler (I.P :save-)
          (lambda save-data [handler data ?file]
            (gos.util.save data (or ?file (. handler name-file)))))
    handler))
(lambda gos.model.dictionary [?file-name ?name ?base]
  (let [name (or ?name :dictionary)
        file-name (or ?file-name name)
        dictionary (gos.model.data
                    file-name name
                    (or ?base (gos.model.basic-thing))
                    [])
        I (gos.util.make-string-inserters name)]
    (tset dictionary (I.I :submit- :-item)
          (lambda submit-dictionary-item [dictionary id item]
            (let [items (: dictionary (I.P :load-))]
              (tset items id item)
              (: dictionary (I.P :save-) items))))
    dictionary))
(lambda gos.model.dimension [?base]
  "Turns ?BASE (or a new basic thing) into a dimension, which is a timer and maker combined."
  (let [dimension (or ?base (gos.model.basic-thing))]
    (when (not dimension.dimension)
      (set dimension.dimension dimension))
    (when (not dimension.schedule-event) (gos.model.timer dimension))
    (when (not dimension.make-thing) (gos.model.maker dimension))
    (let [old-make-thing dimension.make-thing]
      (lambda dimension.make-thing [dimension ?attributes]
        (let [thing (old-make-thing dimension ?attributes)]
          (set thing.dimension dimension)
          thing)))
    dimension))
(lambda gos.model.folder [folder-name ?base]
  (let [folder (or ?base (gos.model.basic-thing))]
    (folder:set-attributes {: folder-name})
    folder))
(lambda gos.model.log [?file-name ?name ?base]
  (let [name (or ?name :log)
        file-name (or ?file-name name)
        logger (gos.model.data file-name name ?base)
        I (gos.util.make-string-inserters name)]
    (tset logger (I.I :submit- :-entry)
          (lambda submit-log-entry [logger entry]
            (let [entries (: logger (I.P :load-))]
              (table.insert entries entry)
              (: logger (I.P :save-) entries))))
    logger))
(lambda gos.model.maker [?base]
  (let [maker (or ?base gos.model.basic-thing)]
    (maker:set-attributes
     {:things []})
    (lambda maker.add-thing [maker thing]
      (table.insert maker.things thing))
    (lambda maker.make-thing [maker ?attributes]
      (let [thing (gos.model.basic-thing nil ?attributes)]
        (maker:add-thing thing)
        (set thing.maker maker)
        thing))
    maker))
(lambda gos.model.map [?file ?name ?base]
  (let [name (or ?name :map)
        base (or ?base (gos.model.basic))
        f (or ?file name)
        file (if (. base :folder)
                 (.. base.folder "/" f)
                 f)
        map (gos.model.dictionary file name base)
        I (gos.util.make-string-inserters name)]
    (tset map (I.I :make- :-item)
          (lambda make-map-item [map name]
            {:name name}))
    (tset map (I.I :submit- :-item)
          (lambda submit-map-item [map entry]
            (let [areas (: map (I.P :load-))
                  area-keys (gos.util.collect-keys areas)
                  area-id (gos.util.make-id area-keys)
                  area {area-id entry}]
              (tset areas area-id entry)
              (: map (I.P :save-) areas)
              area)))
    map))
(lambda gos.model.mud-client [server connection ?base]
  (let [client (or ?base (gos.model.basic-thing))]
    (client:set-attributes
     {:name :Anonymouse
      :mud-connection connection :mud-server server
      :mud-output "" :mud-input "" :mud-commands {}})
    (lambda client.mud-parser [client input]
      (let [(command line) (input:match "([^ ]+) ?(.*)")]
        (var matched? nil)
        (each [key func (pairs client.mud-commands)]
          (when (= command key)
            (set matched? true)
            (func client line)))
        (when (not matched?)
          (client:append-mud-output
           (.. "Invalid command. Input `commands` and press ENTER to "
               "see your available commands.")))))
    (lambda client.append-mud-output [client message]
      (set client.mud-output (.. client.mud-output message "\n")))
    (lambda client.parse-mud-input [client input]
      (client:mud-parser input))
    (lambda client.mud-commands.commands [client input]
      (client:append-mud-output
       (.. "You have access to the following commands: "
           (gos.util.quibble-strings
            (icollect [command func (pairs client.mud-commands)]
              command)
            true))))
    (lambda client.mud-commands.who [client input]
      (client:append-mud-output
       (.. "There are " (length client.mud-server.mud-clients)
           " clients currently connected.")))
    (lambda client.mud-commands.whoami [client input]
      (client:append-mud-output
       (.. "Your name is " (or client.name :unknown) ".")))
    client))
(lambda gos.model.mud-server [?port ?base]
  (let [server (or ?base (gos.model.basic-thing))]
    (server:set-attributes
     {:mudsocket-port (or ?port 4242)
      :mudsocket-timeout 0.001
      :mud-clients []
      :mud-client-models []})
    (lambda server.accept-mud-server-connection [server connection]
      (connection:settimeout server.mudsocket-timeout)
      (let [client (if server.dimension
                       (server.dimension:make-thing)
                       (gos.model.basic-thing))]
        (gos.model.mud-client server connection client)
        (each [_ model (pairs server.mud-client-models)]
          (model client))
        (table.insert server.mud-clients client)
        (server:send-mud-server-new-client-message client)))
    (lambda server.disconnect-mud-server-client [server client]
      (each [key value (pairs server.mud-clients)]
        (when (= value client.mud-connection)
          (table.remove server.mud-clients key))))
    (lambda server.send-mud-server-new-client-message [server client]
      (let [A (gos.util.make-string-appender "\n")]
        (A [(.. "You have connected to "
                (if server.name
                    server.name
                    (if (and server.dimension
                             server.dimension.name)
                        server.dimension.name
                        "a server.")))
            "Interact by inputting commands and pressing ENTER. Use `commands` to see a list of your available commands."])
        (client:append-mud-output (A))))
    (lambda server.start-mud-server [server]
      (set server.mudsocket
           (assert (gos.dep.socket.bind "0.0.0.0"
                                        (or server.mudsocket-port 4242))))
      (server.mudsocket:settimeout (or server.mudsocket-timeout 0.001))
      (when (and server.dimension server.dimension.schedule-event)
        (server.dimension:schedule-event
         (partial server.tick-mud-server server true))))
    (lambda server.tick-mud-server [server ?repeat]
      (let [new-connection (server.mudsocket:accept)]
        (when new-connection (server:accept-mud-server-connection new-connection)))
      (each [_ client (pairs server.mud-clients)]
      (match (client.mud-connection:receive)
        (nil msg) (server:disconnect-mud-server-client client)
        input (client:parse-mud-input input))
      (when (not (= client.mud-output ""))
        (client.mud-connection:send client.mud-output)
        (set client.mud-output "")))
      (when ?repeat
        (server.dimension:schedule-event
         (partial server.tick-mud-server server ?repeat))))
    server))
(lambda gos.model.timer [?base ?tick-rate]
  (let [timer (or ?base (gos.model.basic-thing))]
    (timer:set-attributes
     {:tick-count 0 :tick-rate (or ?tick-rate 0.2) :events []})
    (lambda timer.run-time [timer]
      "Makes TIMER tick-time, then wait for its tick-rate, then re-calls this funciton."
      (timer:tick-time)
      (gos.dep.socket.select nil nil (or timer.tick-rate 0.2))
      (timer:run-time))
    (lambda timer.schedule-event [timer event]
      "Appends EVENT (function) to the end of TIMER's scheduled events."
      (table.insert timer.events event))
    (lambda timer.tick-time [timer]
      (set timer.tick-count (+ timer.tick-count 1))
      (let [current-events timer.events]
        (set timer.events [])
        (each [_ event (pairs current-events)] (event))))
    timer))
;;;; Computers
;;;;; Testers
(lambda gos.computer.alpha []
  (let [alpha (gos.model.timer)]
    alpha))
;;;;; Useful
(lambda gos.computer.meta []
  (let [metacomp (gos.model.changelog
                  nil nil
                  (gos.model.folder :data))]
    metacomp))
(lambda gos.computer.teraum []
  (let [teraum (gos.model.mud-server
                nil
                (gos.model.map
                 nil nil
                (gos.model.dimension
                 (gos.model.folder
                  :teraum
                  (gos.model.basic-thing
                   {:name :Teraum
                    :spawn-room :d6cce35c})))))]
    teraum))
;;; dont delete this line
gos
