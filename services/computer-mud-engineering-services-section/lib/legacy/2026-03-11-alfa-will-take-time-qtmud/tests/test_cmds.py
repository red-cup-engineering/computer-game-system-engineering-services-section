from unittest import TestCase

import qtmud
from qtmud import cmds


def _test_helps(tester, cmd, client):
    tester.assertTrue(cmd(client))
    tester.assertTrue(cmd(client, h=True))
    tester.assertTrue(cmd(client, H=True))


def _test_generic_bad_args(tester, cmd, client):
    tester.assertRaises(TypeError, cmd, client, z=True)
    tester.assertRaises(TypeError, cmd, client, fake='bad')

def _test_nonargued_cmd(tester, cmd,):
    client = qtmud.Client()
    qtmud.subscribers['send'] = [qtmud.subscriptions.send]
    _test_helps(tester, cmd, client)
    _test_generic_bad_args(tester, cmd, client)
    tester.assertTrue(cmd(client))
    tester.assertRaises(TypeError, cmd, client, ['womble'])


class TestCommands(TestCase):
    def test_commands(self):
        _test_nonargued_cmd(self, cmds.commands)


class TestFoo(TestCase):
    def test_foo(self):
        _test_nonargued_cmd(self, cmds.foo)


class TestHelp(TestCase):
    def test_help(self):
        # TODO more thorough tests
        cmd = cmds.help
        client = qtmud.Client()
        qtmud.subscribers['send'] = [qtmud.subscriptions.send]
        _test_helps(self, cmd, client)
        _test_generic_bad_args(self, cmd, client)
        self.assertTrue(cmd(client))
        self.assertTrue(cmd(client, topic='help'))
        self.assertTrue(cmd(client, topic='talker'))
        self.assertTrue(cmd(client, topic='talker', domain='cmds'))
        self.assertFalse(cmd(client, topic='notarealthing'))


class TestQuit(TestCase):
    def test_quit(self):
        _test_nonargued_cmd(self, cmds.quit)


class TestTalker(TestCase):
    def test_talker(self):
        cmd = cmds.talker
        client = qtmud.Client()
        talker = qtmud.active_services['talker'] = qtmud.services.Talker()
        qtmud.subscribers['send'] = [qtmud.subscriptions.send]
        talker.tune_channel(client, 'one')
        _test_helps(self, cmd, client)
        _test_generic_bad_args(self, cmd, client)
        self.assertTrue(cmd(client))
        self.assertTrue(cmd(client, channel='one'))
        self.assertTrue(cmd(client, channel='one', l=True))
        self.assertIsNone(cmd(client, channel='not-a-real-channel'))


class TestWho(TestCase):
    def test_who(self):
        _test_nonargued_cmd(self, cmds.who)


class TestWhoami(TestCase):
    def test_whoami(self):
        _test_nonargued_cmd(self, cmds.who)
