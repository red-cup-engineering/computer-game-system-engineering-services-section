"""This module contains qtMUD's subscriptions: functions which are
triggers as "events" by the game engine.

    .. versionadded: 0.0.5

"""

import click


def broadcast(channel, speaker, message):
    """ Send a message from speaker to everyone on the channel. """
    if not message:
        qtmud.schedule('send', recipient=speaker,
                       text='syntax: {0} <message>\n'
                            'Sends `message` to everyone tuned into `{0}`'
                            ''.format(channel))
    else:
        qtmud.active_services['talker'].broadcast(channel=channel,
                                                  speaker=speaker,
                                                  message=message)
    return True


def client_disconnect(client):
    """ Handle removing a client from qtMUD

        .. warning:: This is likely buggy and going to change
    """
    mudsocket = qtmud.active_services['mudsocket']
    qtmud.log.debug('disconnecting %s from qtmud.', client.name)
    for other in qtmud.connected_clients:
        qtmud.schedule('send',
                       recipient=other,
                       text='{} disconnected.'.format(client.name))
    try:
        qtmud.connected_clients.remove(client)
    except ValueError:
        pass
    socket = mudsocket.get_socket_by_thing(client)
    if socket:
        mudsocket.clients.pop(socket)
        mudsocket.connections.remove(socket)
    return True


def client_login_parser(client, line):
    """ Handle logs-in for arriving players - right now, just a basic check
    against qtmud.client_accounts to see if the client is there already.
    """
    output = ''
    #####
    #
    # start login process
    #
    #####
    if not hasattr(client, 'login_stage'):
        client.login_stage = 0
        output = 'Input [desired] client name and press <enter>.'
    #####
    #
    # check if client exits
    #
    #####
    elif client.login_stage == 0:
        if line in qtmud.client_accounts.keys():
            output = ('There\'s a client named {}, if you\'re them, type your '
                      'password and press <enter>'.format(line))
            client.login_stage = 2
        elif line:
            output = ('No client named {}, going to make an account with that '
                      'name. Type your desired password and press <enter>.'
                      ''.format(line))
            client.login_stage = 1
        else:
            output = ('Your client name can\'t be blank. Input what name '
                      'you\'d like to use and press <enter>.')
        client.name = line
    #####
    #
    # register new client
    #
    #####
    elif client.login_stage == 1:
        qtmud.client_accounts[client.name] = {'password': line}
        qtmud.save_client_accounts()
        client.login_stage = 9
        output = ('Client account registered with name {}, press '
                  '<enter> to finish logging in.'.format(client.name))
    #####
    #
    # login existing account
    #
    #####
    elif client.login_stage == 2:
        if line == qtmud.client_accounts[client.name]['password']:
            client.login_stage = 9
            output = ('That\'s the correct password, press <enter> to finish '
                      'logging in.')
        else:
            client.login_stage = 0
            output = ('That\'s not the right password for that account - '
                      'type your [desired] client name and press <enter>.')
    elif client.login_stage == 9:
        if qtmud.MUDLIB:
            client.input_parser = 'client_mudlib_login_parser'
        else:
            client.input_parser = 'client_command_parser'
        qtmud.active_services['talker'].tune_channel(client=client,
                                                     channel='one')
        qtmud.connected_clients.append(client)
        for c in qtmud.connected_clients:
            qtmud.schedule('send', recipient=c,
                           text='`{}` has connected'.format(client.name))
    if output:
        qtmud.schedule('send', recipient=client, text=output)
    return True


def shutdown(qtmud):
    """ Handles qtMUD shutting down. """
    qtmud.shutdown()


def client_input_parser(client, line):
    """ Pushes a client's input to their designated parser subscription.
    """
    qtmud.schedule('{}'.format(client.input_parser), client=client, line=line)
    return True


def client_command_parser(client, line):
    """ Once a client has logged in, this method handles parsing their input.
    """
    if line:
        spl = line.split(' ')
        command = spl[0]
        if command in client.commands:
            if len(spl) > 1:
                targs = spl[1:]
            else:
                targs = []
            kwargs = {}
            args = []
            for arg in targs:
                if arg.startswith('--'):
                    if '=' in arg:
                        targ = arg[2:].split('=', 1)
                        if len(targ) == 2:
                            kwargs[targ[0]] = targ[1]
                elif arg.startswith('-'):
                    for char in arg[1:]:
                        kwargs[char] = True
                else:
                    args.append(arg)
            try:
                client.commands[command](*args, **kwargs)
            except (SyntaxWarning, SyntaxError, TypeError) as err:
                qtmud.schedule('send', recipient=client,
                               text='{} command failed: {}'
                                    ''.format(command, err))
                client.commands[command](h=True)
                qtmud.log.warning('%s\'s %s command failed: %s',
                                  client.name, command, err)
        elif command in client.channels:
            message = ' '.join(spl[1:])
            qtmud.schedule('broadcast', channel=command,
                           speaker=client,
                           message=message)
        else:
            qtmud.schedule('send',
                           recipient=client,
                           text=('{} is not a valid command; check '
                                 '"commands" for your commands.'
                                 ''.format(command)))
    return True


def send(qtmud, recipient, text):
    """ Prepares text to be sent to the recipient

    :param recipient: expected to be a :class:`thing <qtmud.Thing>`,
                      specifically one with a send_buffer. (In qtmud, this
                      is only clients, though mudlibs may have more things
                      with send_buffers.
    :param text: the text to be appended to the recipient's send_buffer
    :return: True if text is added to recipient's send_buffer, otherwise False.
    """
    log = qtmud.log.getChild('send()')
    log.debug('Sending %s to %s', text, recipient)
    try:
        recipient.send_buffer += text
    except Exception as err:
        log.warning('Failed to send %s to %s: %s', text, recipient, err, exc_info=True)
