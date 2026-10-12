"""This module contains the qtmud command.

    .. versionadded:: 0.1.0

"""
import click
import importlib
import sys

log = None

@click.group()
@click.option('--verbose', is_flag=True,
              help='Show debug, info, warning, error, and critical log messages.')
@click.option('--quiet', is_flag=True,
              help='Show only error, and critical log messages.')
@click.option('--mudlibs',
              envvar='QTMUD_MUDLIBS', default=None,
              help='The MUD library\'s main Python module.')
@click.option('--services',
              envvar='QTMUD_SERVICES', default='ClientUtilities,MUDSocket',
              help='Which services to load, start, and run.', show_default=True)
@click.option('--subscriptions',
              envvar='QTMUD_SUBSCRIPTIONS', default='send,shutdown',
              help='Which subscriptions to enable.', show_default=True)
@click.option('--optional_features',
              envvar='QTMUD_OPTIONAL_FEATURES', default='',
              help='Which optional features to enable.', show_default=True)
@click.pass_context
def qtmud(ctx, verbose, quiet, mudlibs, services, subscriptions, optional_features):
    """Interact with the qtMUD engine.

        .. versionadded:: 0.1.0

    This function (or command, if you're reading this in the command
    line) provides the means for interacting with the qtMUD engine.
    """
    try:
        ctx.ensure_object(dict)
    except Exception as err:
        print('Click, the command parser qtMUD uses, failed to work: {}'.format(err))
    ctx.obj['VERBOSE'] = verbose
    ctx.obj['QUIET'] = quiet
    ctx.obj['QTMUD_MUDLIBS'] = mudlibs
    ctx.obj['QTMUD_SERVICES'] = services
    ctx.obj['QTMUD_SUBSCRIPTIONS'] = subscriptions
    ctx.obj['QTMUD_OPTIONAL_FEATURES'] = optional_features

@qtmud.command()
@click.pass_context
def serve(ctx):
    """Load, start, and run the qtMUD engine.

        .. versionadded:: 0.1.0

    This function (or command, if you're reading this with your
    command line) loads, starts,  and runs a qtMUD server.  It does
    things like set up the MUD library, optional features, server
    ports, and so on.

    NOTE: These options may be set as environmental variables, please
    see README.org, under the "Configuration" heading.  In addition to
    these defaults, the mudlib you load may specify its own default
    subscriptions: please familiarize yourself with its configuration.

    """
    global log
    try:
        driver = importlib.import_module('qtmud').Driver()
        log = driver.log.getChild('qtmud_service')
        log.info('Imported %s version %s', driver.__name__, driver.__version__)
    except Exception as err:
        click.echo('Couldn\'t import the qtmud module: {}\n{}'.format(err, sys.exc_info()))
        exit()
    if ctx.obj['QUIET']:
        log.info(('Making the log stream quiet: only error and critical output will be shown.'))
        driver.log.setLevel('ERROR')
    elif ctx.obj['VERBOSE']:
        log.info('Making the log stream verbose: debug, info, warning, error, and critical output will be shown.')
        driver.log.setLevel('DEBUG')
    try:
        driver.load()
    except Exception as err:
        log.critical('Failed to load qtMUD: %s', err)

@qtmud.command()
@click.pass_context
@click.option('--username', envvar='QTMUD_TEST_USERNAME')
def test(ctx, username):
    """ Test the qtMUD engine against expectations.

        .. versionadded:: 0.1.0

    This function (or command, if you're reading this in the command line).
    """
    click.echo('Test functions have not yet been written (or tied into this command.)')
    click.echo('Hello %s!' % username)
    

