(local util (require :util))

(local timesheet {:history []
                  :active {}})

(fn timesheet.load [timesheet]
  (util.load-file :data/timesheet []))

(fn timesheet.save [timesheet ?save-file]
  (util.save-file :data/timesheet))

(fn timesheet.clock-out [timesheet who ?when]
  (let [entry (. timesheet.active who)]
    (if entry
        (do (table.insert timesheet.history
                      {: who
                       :task (. entry :task)
                       :start-time (. entry :time)
                       :end-time (or ?when (os.time))})
            (timesheet:save))
        (util.log :spam "Nothing to clock-out"))))

(fn timesheet.clock-in [timesheet who task ?when]
  (timesheet:clock-out who ?when)
  (tset timesheet.active who {: task :time (or ?when (os.time))}))

timesheet
