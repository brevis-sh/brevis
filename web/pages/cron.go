package pages

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"brevis.sh/brevis/web/i18n"
)

// CronTextIn is a cron expression in words, in the context's language: CronMsg, said.
// A reader that is not a request (the CLI, the logs) uses it; the console's JSON sends the Msg.
func CronTextIn(ctx context.Context, expr string) string {
	m, ok := CronMsg(expr)
	if !ok {
		return ""
	}
	args := make([]any, 0, 2*len(m.A))
	for k, v := range m.A {
		args = append(args, k, v)
	}
	return i18n.T(ctx, m.K, args...)
}

// CronMsg is a cron expression in words, as the sentence the app says: false for an expression that
// has no plain reading (the app then shows the expression itself).
func CronMsg(expr string) (i18n.Msg, bool) {
	f := strings.Fields(expr)
	if len(f) != 5 {
		return i18n.Msg{}, false
	}
	min, hour, dom, month, dow := f[0], f[1], f[2], f[3], f[4]
	if month != "*" {
		return i18n.Msg{}, false
	}

	if hour == "*" && dom == "*" && dow == "*" {
		if min == "*" {
			return i18n.M("cron.every_minute"), true
		}
		if step, ok := strings.CutPrefix(min, "*/"); ok {
			n, ok := number(step, 1, 30)
			if !ok || 60%n != 0 {
				return i18n.Msg{}, false
			}
			if n == 1 {
				return i18n.M("cron.every_minute"), true
			}
			return i18n.M("cron.every_n", "n", n), true
		}
		if m, ok := number(min, 0, 59); ok {
			return i18n.M("cron.hourly", "m", fmt.Sprintf("%02d", m)), true
		}
		return i18n.Msg{}, false
	}

	m, okM := number(min, 0, 59)
	h, okH := number(hour, 0, 23)
	if !okM || !okH {
		return i18n.Msg{}, false
	}
	at := fmt.Sprintf("%02d:%02d", h, m)
	switch {
	case dom == "*" && dow == "*":
		return i18n.M("cron.daily", "at", at), true
	case dom == "*" && dow == "1-5":
		return i18n.M("cron.weekdays", "at", at), true
	case dow == "*":
		if d, ok := number(dom, 1, 28); ok {
			return i18n.M("cron.monthly", "d", d, "at", at), true
		}
	}
	return i18n.Msg{}, false
}

// number reads a plain cron number in [lo, hi]: digits only, no list, range
// or step.
func number(s string, lo, hi int) (int, bool) {
	if s == "" || strings.TrimLeft(s, "0123456789") != "" {
		return 0, false
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < lo || n > hi {
		return 0, false
	}
	return n, true
}
